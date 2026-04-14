using Azure.Data.Tables;
using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class WinProbabilityController : ControllerBase
    {
        private readonly TableStorageService _tableStorage;
        private readonly IHttpClientFactory _httpClientFactory;

        private static readonly int[] Pars = { 4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4 };

        public WinProbabilityController(TableStorageService tableStorage, IHttpClientFactory httpClientFactory)
        {
            _tableStorage = tableStorage;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet("{year}")]
        public async Task<IActionResult> GetHistory(int year)
        {
            var client = _tableStorage.GetTableClient("WinProbHistory");
            var snapshots = new List<object>();

            await foreach (var entity in client.QueryAsync<TableEntity>(
                e => e.PartitionKey == year.ToString()))
            {
                snapshots.Add(new
                {
                    timestamp = entity.Timestamp,
                    data = entity.GetString("Data")
                });
            }

            return Ok(snapshots);
        }

        /// <summary>
        /// POST /winprobability/{year}/backfill — replay tournament hole-by-hole and generate snapshots
        /// </summary>
        [HttpPost("{year}/backfill")]
        public async Task<IActionResult> Backfill(int year)
        {
            // Fetch current scores
            var httpClient = _httpClientFactory.CreateClient("masters");
            var response = await httpClient.GetAsync($"https://www.masters.com/en_US/scores/feeds/{year}/scores.json");
            if (!response.IsSuccessStatusCode) return StatusCode(502, "Failed to fetch scores");

            var json = await response.Content.ReadAsStringAsync();
            var root = JsonSerializer.Deserialize<Root>(json);
            if (root?.data?.player == null) return BadRequest("No player data");

            // Load draft picks
            var picksClient = _tableStorage.GetDraftPicksClient();
            var draftPicks = new Dictionary<string, List<string>>();
            await foreach (var entity in picksClient.QueryAsync<DraftPickEntity>(e => e.PartitionKey == year.ToString()))
            {
                if (!draftPicks.ContainsKey(entity.OwnerName))
                    draftPicks[entity.OwnerName] = new List<string>();
                draftPicks[entity.OwnerName].Add(entity.GolferName);
            }

            // Build player map
            var playerMap = new Dictionary<string, Player>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in root.data.player)
            {
                var name = Extensions.StringExtensions.RemoveDiacritics(p.first_name) + " " +
                           Extensions.StringExtensions.RemoveDiacritics(p.last_name);
                playerMap[name] = p;
            }

            // Build a timeline of scoring events ordered by golfer progress
            // Each event = (golfer, round, hole, score)
            var events = new List<(string golfer, int round, int hole, int score, int golferHolesAfter)>();
            foreach (var (owner, golfers) in draftPicks)
            {
                foreach (var gname in golfers)
                {
                    if (!playerMap.TryGetValue(gname, out var p)) continue;
                    var rounds = new[] { p.round1, p.round2, p.round3, p.round4 };
                    int totalPlayed = rounds.Sum(r => r.scores.Count(s => s.HasValue && s.Value > 0));
                    int soFar = 0;
                    for (int r = 0; r < 4; r++)
                    {
                        for (int h = 0; h < rounds[r].scores.Count; h++)
                        {
                            if (rounds[r].scores[h].HasValue && rounds[r].scores[h]!.Value > 0)
                            {
                                soFar++;
                                events.Add((gname, r, h, rounds[r].scores[h]!.Value, totalPlayed - soFar));
                            }
                        }
                    }
                }
            }

            // Sort by golferHolesAfter descending (oldest first)
            events.Sort((a, b) => b.golferHolesAfter.CompareTo(a.golferHolesAfter));

            // Replay events and take snapshots at intervals
            // Track scores as we go
            var teamScores = new Dictionary<string, int[,]>(); // owner -> [round, hole] best score
            foreach (var owner in draftPicks.Keys)
                teamScores[owner] = new int[4, 18];

            var golferOwner = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (owner, golfers) in draftPicks)
                foreach (var g in golfers) golferOwner[g] = owner;

            // Track individual golfer scores for best-ball
            var golferScores = new Dictionary<string, int[,]>(StringComparer.OrdinalIgnoreCase);
            foreach (var (owner, golfers) in draftPicks)
                foreach (var g in golfers) golferScores[g] = new int[4, 18];

            // Track holes played per golfer (for remaining calculation)
            var golferHolesPlayed = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var (owner, golfers) in draftPicks)
                foreach (var g in golfers) golferHolesPlayed[g] = 0;

            var histClient = _tableStorage.GetTableClient("WinProbHistory");

            // Clear existing history
            await foreach (var entity in histClient.QueryAsync<TableEntity>(e => e.PartitionKey == year.ToString()))
                await histClient.DeleteEntityAsync(year.ToString(), entity.RowKey);

            int snapshotInterval = Math.Max(events.Count / 40, 5); // ~40 data points
            int snapshotsCreated = 0;
            var baseTime = new DateTimeOffset(year, 4, 9, 12, 0, 0, TimeSpan.Zero); // Tournament start approx

            for (int i = 0; i < events.Count; i++)
            {
                var (golfer, round, hole, score, _) = events[i];
                golferScores[golfer][round, hole] = score;
                golferHolesPlayed[golfer]++;

                // Take snapshot at intervals and at the end
                if (i % snapshotInterval == 0 || i == events.Count - 1)
                {
                    // Compute best-ball points per team
                    var teamPoints = new Dictionary<string, int>();
                    foreach (var (owner, golfers) in draftPicks)
                    {
                        int total = 0;
                        for (int r = 0; r < 4; r++)
                        {
                            for (int h = 0; h < 18; h++)
                            {
                                int best = int.MaxValue;
                                bool anyPlayed = false;
                                foreach (var g in golfers)
                                {
                                    var s = golferScores[g][r, h];
                                    if (s > 0) { anyPlayed = true; if (s < best) best = s; }
                                }
                                if (anyPlayed && best < Pars[h]) total += Pars[h] - best;
                            }
                        }
                        teamPoints[owner] = total;
                    }

                    // Compute holes remaining per team
                    var teamRemaining = new Dictionary<string, int>();
                    foreach (var (owner, golfers) in draftPicks)
                    {
                        int remaining = 0;
                        foreach (var g in golfers)
                        {
                            if (playerMap.TryGetValue(g, out var p) && p.status == "C") continue;
                            remaining += 72 - golferHolesPlayed[g];
                        }
                        teamRemaining[owner] = remaining;
                    }

                    // Run Monte Carlo
                    int totalFieldPts = teamPoints.Values.Sum();
                    int totalFieldHoles = golferHolesPlayed.Where(kv =>
                        playerMap.TryGetValue(kv.Key, out var p) && p.status != "C"
                    ).Sum(kv => kv.Value);
                    double fieldRate = totalFieldHoles > 0 ? (double)totalFieldPts / totalFieldHoles : 0.1;

                    var rng = new Random(42 + i);
                    var wins = new Dictionary<string, int>();
                    foreach (var owner in draftPicks.Keys) wins[owner] = 0;

                    for (int sim = 0; sim < 10000; sim++)
                    {
                        double bestScore = double.MinValue;
                        string bestOwner = "";
                        foreach (var owner in draftPicks.Keys)
                        {
                            int pts = teamPoints[owner];
                            int played = draftPicks[owner].Where(g =>
                                !playerMap.TryGetValue(g, out var p) || p.status != "C"
                            ).Sum(g => golferHolesPlayed.GetValueOrDefault(g));
                            int rem = teamRemaining[owner];

                            double teamRate = played > 0 ? (double)pts / played : fieldRate;
                            double conf = Math.Min(played / 150.0, 0.5);
                            double blended = teamRate * conf + fieldRate * (1 - conf);
                            double expected = blended * rem;
                            double stdDev = Math.Sqrt(rem) * Math.Max(fieldRate, 0.08) * 4;
                            if (rng.NextDouble() < 0.1) stdDev *= 2;

                            double u1 = rng.NextDouble(), u2 = rng.NextDouble();
                            double normal = Math.Sqrt(-2 * Math.Log(u1 == 0 ? 0.001 : u1)) * Math.Cos(2 * Math.PI * u2);
                            double simFinal = pts + Math.Max(0, expected + normal * stdDev);

                            if (simFinal > bestScore) { bestScore = simFinal; bestOwner = owner; }
                        }
                        wins[bestOwner]++;
                    }

                    // Store snapshot
                    // If this is the final event and no holes remaining, give tied winners 100%
                    var noHolesLeft = teamRemaining.Values.All(r => r == 0);
                    var snapshot = new Dictionary<string, object>();
                    if (i == events.Count - 1 && noHolesLeft)
                    {
                        var maxPts = teamPoints.Values.Max();
                        foreach (var owner in draftPicks.Keys)
                        {
                            snapshot[owner] = new { points = teamPoints[owner], winProb = teamPoints[owner] == maxPts ? 100.0 : 0.0 };
                        }
                    }
                    else
                    {
                        foreach (var owner in draftPicks.Keys)
                        {
                            snapshot[owner] = new { points = teamPoints[owner], winProb = Math.Round((double)wins[owner] / 10000 * 100, 1) };
                        }
                    }

                    var ts = baseTime.AddMinutes(i * 2); // Spread timestamps across the tournament
                    var entity = new TableEntity(year.ToString(), ts.Ticks.ToString("D20"))
                    {
                        { "Data", JsonSerializer.Serialize(snapshot) }
                    };
                    await histClient.UpsertEntityAsync(entity);
                    snapshotsCreated++;
                }
            }

            return Ok(new { events = events.Count, snapshots = snapshotsCreated });
        }
    }
}
