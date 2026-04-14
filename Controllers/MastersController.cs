using MastersScores.Extensions;
using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class MastersController : ControllerBase
    {
        private const string CacheKey = "masters_scores";
        private const string CacheKeyRaw = "masters_raw_players";
        private const string CacheKeyLastUpdated = "masters_scores_last_updated";
        private static readonly TimeZoneInfo CentralTime = TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time");
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<MastersController> _logger;
        private readonly NotificationService _notificationService;
        private readonly TableStorageService _tableStorage;
        private static readonly SemaphoreSlim _fetchLock = new(1, 1);
        private static bool _pollingEnabled = true;

        public static bool IsPollingEnabled => _pollingEnabled;
        public static void SetPolling(bool enabled) => _pollingEnabled = enabled;

        public MastersController(
            IHttpClientFactory httpClientFactory,
            IMemoryCache cache,
            ILogger<MastersController> logger,
            NotificationService notificationService,
            TableStorageService tableStorage)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            _logger = logger;
            _notificationService = notificationService;
            _tableStorage = tableStorage;
        }

        [HttpGet]
        public async Task<IEnumerable<MastersResponse.Player>> Get()
        {
            // Serve from cache if fresh (45 seconds)
            if (_cache.TryGetValue(CacheKey, out IEnumerable<MastersResponse.Player>? cached) && cached != null)
                return cached;

            // If polling is disabled, serve stale cache or empty
            if (!_pollingEnabled)
            {
                if (_cache.TryGetValue(CacheKey + "_stale", out IEnumerable<MastersResponse.Player>? staleDisabled) && staleDisabled != null)
                    return staleDisabled;
                return Enumerable.Empty<MastersResponse.Player>();
            }

            // Lock to prevent concurrent fetches / duplicate notifications
            await _fetchLock.WaitAsync();
            try
            {
            // Double-check cache after acquiring lock (another request may have filled it)
            if (_cache.TryGetValue(CacheKey, out cached) && cached != null)
                return cached;

            // Cache miss — fetch from masters.com
            var client = _httpClientFactory.CreateClient("masters");
            var httpResponse = await client.GetAsync($"https://www.masters.com/en_US/scores/feeds/{DateTime.Now.Year}/scores.json");

            if (!httpResponse.IsSuccessStatusCode)
            {
                // Fall back to stale cache (30 min TTL)
                if (_cache.TryGetValue(CacheKey + "_stale", out IEnumerable<MastersResponse.Player>? stale) && stale != null)
                {
                    _logger.LogWarning("masters.com returned {StatusCode} — serving stale cached results", (int)httpResponse.StatusCode);
                    return stale;
                }
                _logger.LogWarning("masters.com returned {StatusCode} and no cached results are available", (int)httpResponse.StatusCode);
                return Enumerable.Empty<MastersResponse.Player>();
            }

            var mastersScores = await httpResponse.Content.ReadAsStringAsync();
            var jsonObject = JsonSerializer.Deserialize<Root>(mastersScores);

            var rawPlayers = jsonObject!.data.player;

            var players = rawPlayers.Select(p =>
            {
                var rounds = new[] { p.round1, p.round2, p.round3, p.round4 };
                string nextTeeTime = "";
                for (int i = 0; i < rounds.Length; i++)
                {
                    var round = rounds[i];
                    bool isComplete = round.scores.Count(s => s.HasValue && s.Value > 0) == 18;
                    if (!isComplete && !string.IsNullOrEmpty(round.teetime))
                    {
                        try { nextTeeTime = DateTime.Parse(round.teetime.Replace("*", "")).AddHours(-1).ToString("hh:mm tt"); }
                        catch { }
                        break;
                    }
                }

                return new MastersResponse.Player
                {
                    FullName = p.first_name.RemoveDiacritics() + " " + p.last_name.RemoveDiacritics(),
                    Round1 = string.Join("|", p.round1.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                    Round2 = string.Join("|", p.round2.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                    Round3 = string.Join("|", p.round3.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                    Round4 = string.Join("|", p.round4.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                    TeeTime = nextTeeTime,
                    ToPar = p.topar ?? "",
                    Status = p.status ?? ""
                };
            }).ToList();

            // Parse current round
            int.TryParse(jsonObject.data.currentRound, out var rawRound);
            var currentRound = rawRound / 1000;

            // Compute projected cut line
            int? projectedCut = null;
            var allToPar = rawPlayers
                .Where(p => !string.IsNullOrEmpty(p.topar) && p.topar != "E")
                .Select(p => { int.TryParse(p.topar, out var v); return v; })
                .OrderBy(v => v)
                .ToList();
            // Include E (even par = 0)
            var evenCount = rawPlayers.Count(p => p.topar == "E");
            var allScores = Enumerable.Repeat(0, evenCount).Concat(allToPar).OrderBy(v => v).ToList();
            if (allScores.Count >= 50)
                projectedCut = allScores[49];

            // Cache for 45 seconds (fresh) and 30 minutes (stale fallback)
            _cache.Set(CacheKey, players, TimeSpan.FromSeconds(45));
            _cache.Set(CacheKey + "_stale", players, TimeSpan.FromMinutes(30));
            _cache.Set(CacheKeyRaw, rawPlayers, TimeSpan.FromMinutes(30));
            _cache.Set("masters_current_round", currentRound);
            _cache.Set("masters_projected_cut", projectedCut);
            _cache.Set(CacheKeyLastUpdated, DateTimeOffset.UtcNow);

            // Run notifications on fresh fetch (fire and forget, don't block response)
            _ = Task.Run(async () =>
            {
                try
                {
                    var picks = await LoadDraftPicks();
                    if (picks.Count > 0)
                        await _notificationService.ProcessScoreUpdate(rawPlayers, picks);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing notifications");
                }
            });

            return players;
            }
            finally
            {
                _fetchLock.Release();
            }
        }

        [HttpGet("tournament")]
        public async Task<IActionResult> GetTournament()
        {
            var players = (await Get()).ToList();

            _cache.TryGetValue("masters_current_round", out int currentRound);
            _cache.TryGetValue("masters_projected_cut", out int? projectedCut);

            return Ok(new TournamentState
            {
                CurrentRound = currentRound,
                Players = players,
                ProjectedCutLine = projectedCut
            });
        }

        [HttpGet("polling")]
        public IActionResult GetPollingStatus()
        {
            return Ok(new { enabled = _pollingEnabled });
        }

        [HttpPost("polling")]
        public IActionResult SetPollingStatus([FromBody] PollingRequest request)
        {
            _pollingEnabled = request.Enabled;
            _logger.LogInformation("Polling {Status}", _pollingEnabled ? "enabled" : "disabled");
            return Ok(new { enabled = _pollingEnabled });
        }

        public class PollingRequest { public bool Enabled { get; set; } }

        [HttpGet("lastUpdated")]
        public IActionResult GetLastUpdated()
        {
            if (!_cache.TryGetValue(CacheKeyLastUpdated, out DateTimeOffset lastUpdatedUtc))
                return NotFound("No live scores have been fetched yet.");

            var centralTime = TimeZoneInfo.ConvertTime(lastUpdatedUtc, CentralTime);
            return Ok(centralTime.ToString("yyyy-MM-dd hh:mm:ss tt zzz"));
        }

        private async Task<Dictionary<string, List<string>>> LoadDraftPicks()
        {
            if (_cache.TryGetValue("draft_picks_map", out Dictionary<string, List<string>>? cached) && cached != null)
                return cached;

            var client = _tableStorage.GetDraftPicksClient();
            var picks = new Dictionary<string, List<string>>();
            await foreach (var entity in client.QueryAsync<DraftPickEntity>(e => e.PartitionKey == DateTime.Now.Year.ToString()))
            {
                if (!picks.ContainsKey(entity.OwnerName))
                    picks[entity.OwnerName] = new List<string>();
                picks[entity.OwnerName].Add(entity.GolferName);
            }
            _cache.Set("draft_picks_map", picks, TimeSpan.FromHours(1));
            return picks;
        }
    }
}
