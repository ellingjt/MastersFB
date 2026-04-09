using MastersScores.Extensions;
using MastersScores.Models;
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
        private const string CacheKeyLastUpdated = "masters_scores_last_updated";
        private static readonly TimeZoneInfo CentralTime = TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time");
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<MastersController> _logger;

        public MastersController(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<MastersController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IEnumerable<MastersResponse.Player>> Get()
        {
            var client = _httpClientFactory.CreateClient("masters");
            var httpResponse = await client.GetAsync($"https://www.masters.com/en_US/scores/feeds/{DateTime.Now.Year}/scores.json");

            if (!httpResponse.IsSuccessStatusCode)
            {
                if (_cache.TryGetValue(CacheKey, out IEnumerable<MastersResponse.Player>? cached) && cached != null)
                {
                    _logger.LogWarning("masters.com returned {StatusCode} — serving stale cached results", (int)httpResponse.StatusCode);
                    return cached;
                }

                _logger.LogWarning("masters.com returned {StatusCode} and no cached results are available", (int)httpResponse.StatusCode);
                return Enumerable.Empty<MastersResponse.Player>();
            }

            var mastersScores = await httpResponse.Content.ReadAsStringAsync();
            var jsonObject = JsonSerializer.Deserialize<Root>(mastersScores);

            var players = jsonObject!.data.player.Select(p => new MastersResponse.Player
            {
                FullName = p.first_name.RemoveDiacritics() + " " + p.last_name.RemoveDiacritics(),
                Round1 = string.Join("|", p.round1.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                Round2 = string.Join("|", p.round2.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                Round3 = string.Join("|", p.round3.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                Round4 = string.Join("|", p.round4.scores.Select(y => y.HasValue ? y.Value.ToString() : "0")),
                TeeTime = string.IsNullOrEmpty(p.teetime) ? "" : DateTime.Parse(p.teetime.Replace("*", "")).AddHours(-1).ToString("hh:mm tt")
            }).ToList();

            _cache.Set(CacheKey, players, TimeSpan.FromMinutes(30));
            _cache.Set(CacheKeyLastUpdated, DateTimeOffset.UtcNow);

            return players;
        }

        [HttpGet("lastUpdated")]
        public IActionResult GetLastUpdated()
        {
            if (!_cache.TryGetValue(CacheKeyLastUpdated, out DateTimeOffset lastUpdatedUtc))
                return NotFound("No live scores have been fetched yet.");

            var centralTime = TimeZoneInfo.ConvertTime(lastUpdatedUtc, CentralTime);
            return Ok(centralTime.ToString("yyyy-MM-dd hh:mm:ss tt zzz"));
        }
    }
}
