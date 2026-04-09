using Azure;
using Azure.Data.Tables;
using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ShotgunsController : ControllerBase
    {
        private readonly TableClient _tableClient;

        public ShotgunsController(TableStorageService tableStorage)
        {
            _tableClient = tableStorage.GetTableClient("Shotguns");
        }

        [HttpGet("{year}")]
        public async Task<IActionResult> Get(string year)
        {
            try
            {
                var entity = await _tableClient.GetEntityAsync<ShotgunStateEntity>(year, "state");
                return Ok(new
                {
                    completedIds = JsonSerializer.Deserialize<List<string>>(entity.Value.CompletedIds),
                    titsAssignedTo = entity.Value.TitsAssignedTo
                });
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return Ok(new { completedIds = new List<string>(), titsAssignedTo = "" });
            }
        }

        [HttpPost("{year}/complete")]
        public async Task<IActionResult> ToggleComplete(string year, [FromBody] ToggleRequest request)
        {
            var entity = await GetOrCreateState(year);

            var ids = JsonSerializer.Deserialize<List<string>>(entity.CompletedIds) ?? new List<string>();

            if (request.Completed && !ids.Contains(request.Id))
                ids.Add(request.Id);
            else if (!request.Completed)
                ids.Remove(request.Id);

            entity.CompletedIds = JsonSerializer.Serialize(ids);
            await _tableClient.UpsertEntityAsync(entity);

            return Ok(new { completedIds = ids });
        }

        [HttpPost("{year}/tits-assign")]
        public async Task<IActionResult> AssignTits(string year, [FromBody] TitsAssignRequest request)
        {
            var entity = await GetOrCreateState(year);
            entity.TitsAssignedTo = request.AssignedTo;
            await _tableClient.UpsertEntityAsync(entity);
            return Ok(new { titsAssignedTo = request.AssignedTo });
        }

        private async Task<ShotgunStateEntity> GetOrCreateState(string year)
        {
            try
            {
                var response = await _tableClient.GetEntityAsync<ShotgunStateEntity>(year, "state");
                return response.Value;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return new ShotgunStateEntity { PartitionKey = year };
            }
        }

        public class ToggleRequest
        {
            public string Id { get; set; } = default!;
            public bool Completed { get; set; }
        }

        public class TitsAssignRequest
        {
            public string AssignedTo { get; set; } = default!;
        }
    }
}
