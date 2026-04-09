using Azure.Data.Tables;
using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class DraftPicksController : ControllerBase
    {
        private readonly TableClient _tableClient;

        public DraftPicksController(TableStorageService tableStorage)
        {
            _tableClient = tableStorage.GetDraftPicksClient();
        }

        /// <summary>
        /// GET /draftpicks/{year} — returns all picks for a tournament year
        /// </summary>
        [HttpGet("{year}")]
        public async Task<IActionResult> GetByYear(string year)
        {
            var picks = new List<DraftPickEntity>();
            await foreach (var entity in _tableClient.QueryAsync<DraftPickEntity>(e => e.PartitionKey == year))
            {
                picks.Add(entity);
            }

            var teams = picks
                .GroupBy(p => p.OwnerName)
                .ToDictionary(g => g.Key, g => g.OrderBy(p => p.PickNumber).Select(p => p.GolferName).ToList());

            return Ok(teams);
        }

        /// <summary>
        /// POST /draftpicks/{year}/seed — bulk-load picks for a year.
        /// Body: { "Owner1": ["Golfer1", "Golfer2"], "Owner2": ["Golfer3", "Golfer4"] }
        /// </summary>
        [HttpPost("{year}/seed")]
        public async Task<IActionResult> Seed(string year, [FromBody] Dictionary<string, List<string>> teams)
        {
            var entities = new List<DraftPickEntity>();

            foreach (var (owner, golfers) in teams)
            {
                for (int i = 0; i < golfers.Count; i++)
                {
                    var entity = new DraftPickEntity
                    {
                        PartitionKey = year,
                        RowKey = $"{owner}_{i + 1}",
                        OwnerName = owner,
                        GolferName = golfers[i],
                        PickNumber = i + 1
                    };
                    entities.Add(entity);
                }
            }

            foreach (var entity in entities)
            {
                await _tableClient.UpsertEntityAsync(entity);
            }

            return Ok(new { count = entities.Count });
        }
    }
}
