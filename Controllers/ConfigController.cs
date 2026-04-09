using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ConfigController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly TableStorageService _tableStorage;
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public ConfigController(IWebHostEnvironment env, TableStorageService tableStorage)
        {
            _env = env;
            _tableStorage = tableStorage;
        }

        /// <summary>
        /// GET /config/{year} — returns year config (history, pre-tournament shotguns, draft picks)
        /// </summary>
        [HttpGet("{year}")]
        public IActionResult GetConfig(int year)
        {
            var config = LoadYearConfig(year);
            if (config == null)
                return NotFound($"No config file found for {year}");

            return Ok(config);
        }

        /// <summary>
        /// POST /config/{year}/seed — loads data/YYYY.json into Table Storage (draft picks)
        /// </summary>
        [HttpPost("{year}/seed")]
        public async Task<IActionResult> Seed(int year)
        {
            var config = LoadYearConfig(year);
            if (config == null)
                return NotFound($"No config file found for {year}");

            // Seed draft picks
            var picksClient = _tableStorage.GetDraftPicksClient();
            var count = 0;
            foreach (var (owner, golfers) in config.DraftPicks)
            {
                for (int i = 0; i < golfers.Count; i++)
                {
                    var entity = new DraftPickEntity
                    {
                        PartitionKey = year.ToString(),
                        RowKey = $"{owner}_{i + 1}",
                        OwnerName = owner,
                        GolferName = golfers[i],
                        PickNumber = i + 1
                    };
                    await picksClient.UpsertEntityAsync(entity);
                    count++;
                }
            }

            return Ok(new { draftPicks = count, year });
        }

        private YearConfig? LoadYearConfig(int year)
        {
            var path = Path.Combine(_env.ContentRootPath, "data", $"{year}.json");
            if (!System.IO.File.Exists(path))
                return null;

            var json = System.IO.File.ReadAllText(path);
            return JsonSerializer.Deserialize<YearConfig>(json, JsonOptions);
        }
    }
}
