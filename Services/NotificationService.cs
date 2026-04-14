using Azure;
using Azure.Data.Tables;
using MastersScores.Hubs;
using MastersScores.Models;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace MastersScores.Services
{
    public class NotificationStateEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = default!;
        public string RowKey { get; set; } = "state";
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }
        public string CutGolfers { get; set; } = "[]";
        public string FirstStr { get; set; } = "";
        public string LastStr { get; set; } = "";
        public string ShotgunIds { get; set; } = "[]";
        public string BogeyWatchIds { get; set; } = "[]";
        public string LastPlaceNotified { get; set; } = "";
    }

    /// <summary>
    /// Singleton service that detects state changes and fires chat notifications.
    /// State is persisted to Table Storage so it survives app restarts.
    /// </summary>
    public class NotificationService
    {
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly TableStorageService _tableStorage;
        private readonly ILogger<NotificationService> _logger;

        private HashSet<string> _prevCutGolfers = new();
        private string _prevFirstStr = "";
        private string _prevLastStr = "";
        private HashSet<string> _prevShotgunIds = new();
        private string _lastPlaceNotified = "";
        private HashSet<string> _prevBogeyWatchIds = new();
        private bool _initialized = false;

        private static readonly int[] Pars = { 4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4 };

        public NotificationService(
            IHubContext<ChatHub> hubContext,
            TableStorageService tableStorage,
            ILogger<NotificationService> logger)
        {
            _hubContext = hubContext;
            _tableStorage = tableStorage;
            _logger = logger;
        }

        private async Task LoadState(int year)
        {
            if (_initialized) return;
            try
            {
                var client = _tableStorage.GetTableClient("NotificationState");
                var entity = await client.GetEntityAsync<NotificationStateEntity>(year.ToString(), "state");
                _prevCutGolfers = JsonSerializer.Deserialize<HashSet<string>>(entity.Value.CutGolfers) ?? new();
                _prevFirstStr = entity.Value.FirstStr;
                _prevLastStr = entity.Value.LastStr;
                _prevShotgunIds = JsonSerializer.Deserialize<HashSet<string>>(entity.Value.ShotgunIds) ?? new();
                _prevBogeyWatchIds = JsonSerializer.Deserialize<HashSet<string>>(entity.Value.BogeyWatchIds) ?? new();
                _lastPlaceNotified = entity.Value.LastPlaceNotified ?? "";
                _initialized = true;
                _logger.LogInformation("Loaded notification state from storage");
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                // No saved state — first run of the year, set baseline on first fetch
                _logger.LogInformation("No saved notification state, will set baseline on first fetch");
            }
        }

        private async Task SaveState(int year)
        {
            try
            {
                var client = _tableStorage.GetTableClient("NotificationState");
                var entity = new NotificationStateEntity
                {
                    PartitionKey = year.ToString(),
                    CutGolfers = JsonSerializer.Serialize(_prevCutGolfers),
                    FirstStr = _prevFirstStr,
                    LastStr = _prevLastStr,
                    ShotgunIds = JsonSerializer.Serialize(_prevShotgunIds),
                    BogeyWatchIds = JsonSerializer.Serialize(_prevBogeyWatchIds),
                    LastPlaceNotified = _lastPlaceNotified,
                };
                await client.UpsertEntityAsync(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save notification state");
            }
        }

        /// <summary>
        /// Called on each fresh masters.com fetch. Compares with previous state and fires notifications.
        /// </summary>
        public async Task ProcessScoreUpdate(List<Player> rawPlayers, Dictionary<string, List<string>> draftPicks)
        {
            if (draftPicks.Count == 0 || rawPlayers.Count == 0) return;

            var year = DateTime.Now.Year;
            var stateChanged = false;

            // Load persisted state on first call (survives app restarts)
            await LoadState(year);

            // Build lookup by cleaned name
            var playerMap = new Dictionary<string, Player>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in rawPlayers)
            {
                var name = Extensions.StringExtensions.RemoveDiacritics(p.first_name) + " " +
                           Extensions.StringExtensions.RemoveDiacritics(p.last_name);
                playerMap[name] = p;
            }

            // === 1. CUT NOTIFICATIONS ===
            var currentCuts = new HashSet<string>();
            foreach (var (owner, golfers) in draftPicks)
            {
                foreach (var golferName in golfers)
                {
                    if (playerMap.TryGetValue(golferName, out var p) && p.status == "C")
                        currentCuts.Add($"{owner}|{golferName}");
                }
            }

            if (_initialized)
            {
                var newCutsByOwner = new Dictionary<string, List<string>>();
                foreach (var key in currentCuts)
                {
                    if (!_prevCutGolfers.Contains(key))
                    {
                        var parts = key.Split('|');
                        if (!newCutsByOwner.ContainsKey(parts[0]))
                            newCutsByOwner[parts[0]] = new List<string>();
                        newCutsByOwner[parts[0]].Add(parts[1]);
                    }
                }

                foreach (var (owner, golfers) in newCutsByOwner)
                {
                    var msg = golfers.Count == 1
                        ? $"\uD83C\uDF7A {owner} owes a shotgun \u2014 {golfers[0]} missed the cut"
                        : $"\uD83C\uDF7A {owner} owes {golfers.Count} shotguns \u2014 {string.Join(", ", golfers)} missed the cut";
                    await SendSystemMessage(year, msg);
                }
            }
            if (!_prevCutGolfers.SetEquals(currentCuts)) stateChanged = true;
            _prevCutGolfers = currentCuts;

            // === 2. TEAM BOGEY / DOUBLE BOGEY ===
            var currentShotgunIds = new HashSet<string>();
            foreach (var (owner, golfers) in draftPicks)
            {
                var nonCut = golfers
                    .Select(g => playerMap.GetValueOrDefault(g))
                    .Where(p => p != null && p.status != "C")
                    .ToList();

                for (int r = 0; r < 4; r++)
                {
                    var allStarted = nonCut.All(p => GetRound(p!, r).scores.Any(s => s.HasValue && s.Value > 0));
                    if (!allStarted) continue;

                    for (int h = 0; h < 18; h++)
                    {
                        var allPlayed = nonCut.All(p =>
                        {
                            var s = GetRound(p!, r).scores;
                            return h < s.Count && s[h].HasValue && s[h]!.Value > 0;
                        });
                        if (!allPlayed) continue;

                        var bestScore = nonCut
                            .Select(p => GetRound(p!, r).scores[h])
                            .Where(s => s.HasValue && s.Value > 0)
                            .Min(s => s!.Value);

                        var diff = bestScore - Pars[h];
                        if (diff == 1)
                            currentShotgunIds.Add($"bogey_{owner}_R{r + 1}H{h + 1}");
                        else if (diff >= 2)
                            currentShotgunIds.Add($"dblbogey_{owner}_R{r + 1}H{h + 1}");
                    }
                }
            }

            if (_initialized)
            {
                foreach (var id in currentShotgunIds)
                {
                    if (_prevShotgunIds.Contains(id)) continue;
                    var isDbl = id.StartsWith("dblbogey");
                    var prefix = isDbl ? "dblbogey_" : "bogey_";
                    var rest = id.Substring(prefix.Length);
                    var locIdx = rest.LastIndexOf("_R");
                    var owner = rest.Substring(0, locIdx);
                    var location = rest.Substring(locIdx + 1); // e.g. "R3H7"
                    var roundNum = location.Substring(1, 1);
                    var holeNum = location.Substring(3);
                    var typeStr = isDbl ? "Team double bogey" : "Team bogey";
                    var countStr = isDbl ? "2 shotguns" : "a shotgun";
                    var msg = $"\uD83C\uDF7A {owner} owes {countStr} \u2014 {typeStr} on R{roundNum} #{holeNum}";
                    await SendSystemMessage(year, msg);
                }
            }
            if (!_prevShotgunIds.SetEquals(currentShotgunIds)) stateChanged = true;
            _prevShotgunIds = currentShotgunIds;

            // === 3. BOGEY WATCH ===
            var currentWatchIds = new HashSet<string>();
            foreach (var (owner, golfers) in draftPicks)
            {
                var nonCutAll = golfers
                    .Select(g => playerMap.GetValueOrDefault(g))
                    .Where(p => p != null && p.status != "C")
                    .ToList();
                if (nonCutAll.Count < 2) continue;

                for (int r = 0; r < 4; r++)
                {
                    // Need at least 1 golfer to have started this round
                    var anyStarted = nonCutAll.Any(p => GetRound(p!, r).scores.Any(s => s.HasValue && s.Value > 0));
                    if (!anyStarted) continue;

                    for (int h = 0; h < 18; h++)
                    {
                        var played = new List<Player>();
                        var notPlayed = new List<Player>();
                        foreach (var p in nonCutAll)
                        {
                            var s = GetRound(p!, r).scores;
                            if (h < s.Count && s[h].HasValue && s[h]!.Value > 0)
                                played.Add(p!);
                            else
                                notPlayed.Add(p!);
                        }

                        // Exactly 1 golfer hasn't played this hole yet
                        if (notPlayed.Count != 1 || played.Count < 1) continue;
                        // All who played scored bogey or worse
                        if (!played.All(p => GetRound(p, r).scores[h]!.Value > Pars[h])) continue;

                        currentWatchIds.Add($"bogeywatch_{owner}_R{r + 1}H{h + 1}");
                    }
                }
            }

            if (_initialized)
            {
                foreach (var id in currentWatchIds)
                {
                    if (_prevBogeyWatchIds.Contains(id)) continue;

                    var afterPrefix = id.Substring("bogeywatch_".Length);
                    var lastUnderscore = afterPrefix.LastIndexOf("_R");
                    var owner = afterPrefix.Substring(0, lastUnderscore);
                    var location = afterPrefix.Substring(lastUnderscore + 1);
                    var rIdx = int.Parse(location.Substring(1, 1)) - 1;
                    var hIdx = int.Parse(location.Substring(3)) - 1;

                    var saver = draftPicks[owner]
                        .Select(g => playerMap.GetValueOrDefault(g))
                        .Where(p => p != null && p.status != "C")
                        .FirstOrDefault(p =>
                        {
                            var s = GetRound(p!, rIdx).scores;
                            return hIdx >= s.Count || !s[hIdx].HasValue || s[hIdx]!.Value == 0;
                        });

                    var saverName = saver != null
                        ? Extensions.StringExtensions.RemoveDiacritics(saver.last_name)
                        : "someone";

                    var msg = $"\u26A0\uFE0F BOGEY WATCH: {owner}'s team \u2014 R{rIdx + 1} #{hIdx + 1}. {saverName} needs to save it!";
                    await SendSystemMessage(year, msg);
                }
            }
            if (!_prevBogeyWatchIds.SetEquals(currentWatchIds)) stateChanged = true;
            _prevBogeyWatchIds = currentWatchIds;

            // === 4. LEADER CHANGES ===
            var teamPoints = new Dictionary<string, int>();
            foreach (var (owner, golfers) in draftPicks)
            {
                var total = 0;
                var golferData = golfers
                    .Select(g => playerMap.GetValueOrDefault(g))
                    .Where(p => p != null)
                    .ToList();

                for (int r = 0; r < 4; r++)
                {
                    for (int h = 0; h < 18; h++)
                    {
                        var scores = golferData
                            .Select(p => GetRound(p!, r).scores)
                            .Where(s => h < s.Count && s[h].HasValue && s[h]!.Value > 0)
                            .Select(s => s[h]!.Value)
                            .ToList();
                        if (scores.Count == 0) continue;
                        var best = scores.Min();
                        if (best < Pars[h]) total += Pars[h] - best;
                    }
                }
                teamPoints[owner] = total;
            }

            var sorted = teamPoints.OrderByDescending(kv => kv.Value).ToList();
            var topScore = sorted.First().Value;
            var bottomScore = sorted.Last().Value;
            var allTied = topScore == bottomScore;

            var firstStr = allTied ? "" : string.Join(",", sorted.Where(kv => kv.Value == topScore).Select(kv => kv.Key).OrderBy(x => x));
            var lastStr = allTied ? "" : string.Join(",", sorted.Where(kv => kv.Value == bottomScore).Select(kv => kv.Key).OrderBy(x => x));

            if (_initialized && !string.IsNullOrEmpty(firstStr) && firstStr != _prevFirstStr)
            {
                var prevFirstSet = new HashSet<string>(_prevFirstStr.Split(',', StringSplitOptions.RemoveEmptyEntries));
                var firstNames = firstStr.Split(',');

                foreach (var owner in firstNames)
                {
                    var isNew = !prevFirstSet.Contains(owner);
                    var wentSolo = !isNew && _prevFirstStr.Contains(',') && !firstStr.Contains(',');
                    if (isNew)
                    {
                        var msg = firstNames.Length == 1
                            ? $"\uD83C\uDFC6 {owner} takes the ( . )( . )!"
                            : $"\uD83C\uDFC6 {owner} has their hands on the ( . )( . )!";
                        await SendSystemMessage(year, msg);
                    }
                    else if (wentSolo)
                    {
                        await SendSystemMessage(year, $"\uD83C\uDFC6 {owner} takes sole possession of the ( . )( . )!");
                    }
                }
            }

            if (_initialized && !string.IsNullOrEmpty(lastStr) && lastStr != _prevLastStr)
            {
                var prevLastSet = new HashSet<string>(_prevLastStr.Split(',', StringSplitOptions.RemoveEmptyEntries));
                var lastNames = lastStr.Split(',');

                foreach (var owner in lastNames)
                {
                    var isNew = !prevLastSet.Contains(owner);
                    var wentSolo = !isNew && _prevLastStr.Contains(',') && !lastStr.Contains(',');
                    if (isNew)
                    {
                        var msg = lastNames.Length == 1
                            ? $"\uD83C\uDF46 The 8====D has found a new home with {owner}!"
                            : $"\uD83C\uDF46 {owner} grabbed a piece of the 8====D!";
                        await SendSystemMessage(year, msg);
                    }
                    else if (wentSolo)
                    {
                        await SendSystemMessage(year, $"\uD83C\uDF46 {owner} is now the sole owner of the 8====D!");
                    }
                }
            }

            if (_prevFirstStr != firstStr || _prevLastStr != lastStr) stateChanged = true;
            _prevFirstStr = firstStr;
            _prevLastStr = lastStr;

            // === 4b. LAST PLACE SHOTGUN — only after tournament is fully complete, fire once ===
            var tournamentComplete = rawPlayers.All(p =>
                p.status == "C" || p.status == "F" ||
                GetRound(p, 3).scores.Count(s => s.HasValue && s.Value > 0) == 18
            ) && rawPlayers.Any(p => GetRound(p, 3).scores.Any(s => s.HasValue && s.Value > 0));

            if (_initialized && tournamentComplete && !allTied && _lastPlaceNotified != lastStr)
            {
                var lastNames = lastStr.Split(',', StringSplitOptions.RemoveEmptyEntries);
                var msg = lastNames.Length == 1
                    ? $"\uD83C\uDF7A {lastNames[0]} owes a shotgun \u2014 Last place finish"
                    : $"\uD83C\uDF7A {string.Join(" and ", lastNames)} each owe a shotgun \u2014 Last place finish";
                await SendSystemMessage(year, msg);
                _lastPlaceNotified = lastStr;
                stateChanged = true;
            }

            // === 5. WIN PROBABILITY SNAPSHOT ===
            // Only compute and store when standings changed
            if (stateChanged && _initialized)
            {
                try
                {
                    await SaveWinProbabilitySnapshot(year, teamPoints, rawPlayers, draftPicks);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to save win probability snapshot");
                }
            }

            // Persist state only if something changed or this is the first run
            if (stateChanged || !_initialized)
                await SaveState(year);

            _initialized = true;
        }

        private async Task SaveWinProbabilitySnapshot(int year, Dictionary<string, int> teamPoints, List<Player> rawPlayers, Dictionary<string, List<string>> draftPicks)
        {
            var playerMap = new Dictionary<string, Player>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in rawPlayers)
            {
                var name = Extensions.StringExtensions.RemoveDiacritics(p.first_name) + " " +
                           Extensions.StringExtensions.RemoveDiacritics(p.last_name);
                playerMap[name] = p;
            }

            // Calculate holes played/remaining per team
            var teamData = new Dictionary<string, (int points, int holesPlayed, int holesRemaining)>();
            int totalFieldPoints = 0, totalFieldHoles = 0;

            foreach (var (owner, golfers) in draftPicks)
            {
                int played = 0, remaining = 0;
                foreach (var gname in golfers)
                {
                    if (!playerMap.TryGetValue(gname, out var p) || p.status == "C") continue;
                    int gPlayed = 0;
                    for (int r = 0; r < 4; r++)
                    {
                        var scores = GetRound(p, r).scores;
                        gPlayed += scores.Count(s => s.HasValue && s.Value > 0);
                    }
                    played += gPlayed;
                    remaining += 72 - gPlayed;
                    totalFieldHoles += gPlayed;
                }
                totalFieldPoints += teamPoints.GetValueOrDefault(owner);
                teamData[owner] = (teamPoints.GetValueOrDefault(owner), played, remaining);
            }

            double fieldRate = totalFieldHoles > 0 ? (double)totalFieldPoints / totalFieldHoles : 0.1;

            // Monte Carlo simulation (10,000 iterations)
            var rng = new Random(42);
            var wins = new Dictionary<string, int>();
            foreach (var owner in draftPicks.Keys) wins[owner] = 0;

            for (int sim = 0; sim < 10000; sim++)
            {
                double bestScore = double.MinValue;
                string bestOwner = "";

                foreach (var (owner, (points, played, remaining)) in teamData)
                {
                    double teamRate = played > 0 ? (double)points / played : fieldRate;
                    double confidence = Math.Min(played / 150.0, 0.5);
                    double blended = teamRate * confidence + fieldRate * (1 - confidence);
                    double expected = blended * remaining;
                    double stdDev = Math.Sqrt(remaining) * Math.Max(fieldRate, 0.08) * 4;

                    // Fat tail: 10% chance of breakout/collapse
                    if (rng.NextDouble() < 0.1) stdDev *= 2;

                    double simRemaining = Math.Max(0, expected + NormalRandom(rng) * stdDev);
                    double simFinal = points + simRemaining;

                    if (simFinal > bestScore) { bestScore = simFinal; bestOwner = owner; }
                }
                wins[bestOwner] = wins.GetValueOrDefault(bestOwner) + 1;
            }

            // Build snapshot data
            var snapshot = new Dictionary<string, object>();
            foreach (var (owner, (points, played, remaining)) in teamData)
            {
                snapshot[owner] = new { points, winProb = Math.Round((double)wins.GetValueOrDefault(owner) / 10000 * 100, 1) };
            }

            // Store to Table Storage
            var client = _tableStorage.GetTableClient("WinProbHistory");
            var entity = new Azure.Data.Tables.TableEntity(year.ToString(), DateTimeOffset.UtcNow.Ticks.ToString("D20"))
            {
                { "Data", JsonSerializer.Serialize(snapshot) }
            };
            await client.UpsertEntityAsync(entity);
            _logger.LogInformation("Saved win probability snapshot");
        }

        private static double NormalRandom(Random rng)
        {
            double u1 = rng.NextDouble();
            double u2 = rng.NextDouble();
            return Math.Sqrt(-2 * Math.Log(u1 == 0 ? 0.001 : u1)) * Math.Cos(2 * Math.PI * u2);
        }

        private Round GetRound(Player player, int roundIndex)
        {
            return roundIndex switch
            {
                0 => player.round1,
                1 => player.round2,
                2 => player.round3,
                _ => player.round4,
            };
        }

        private async Task SendSystemMessage(int year, string message)
        {
            _logger.LogInformation("Notification: {Message}", message);

            var chatClient = _tableStorage.GetChatMessagesClient();
            var sentAt = DateTimeOffset.UtcNow;
            var entity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = sentAt.Ticks.ToString("D20"),
                Username = "System",
                Message = message,
                Type = "system",
                SentAt = sentAt,
            };
            await chatClient.UpsertEntityAsync(entity);

            await _hubContext.Clients.All.SendAsync("ReceiveMessage", new
            {
                username = "System",
                message,
                type = "system",
                sentAt,
            });
        }
    }
}
