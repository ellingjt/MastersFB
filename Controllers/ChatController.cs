using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;

namespace MastersScores.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly TableStorageService _tableStorage;

        public ChatController(TableStorageService tableStorage)
        {
            _tableStorage = tableStorage;
        }

        /// <summary>
        /// GET /chat/{year}?last=50 — returns recent messages
        /// </summary>
        [HttpGet("{year}")]
        public async Task<IActionResult> GetMessages(int year, [FromQuery] int last = 50)
        {
            var client = _tableStorage.GetChatMessagesClient();
            var messages = new List<object>();

            await foreach (var entity in client.QueryAsync<ChatMessageEntity>(
                e => e.PartitionKey == year.ToString()))
            {
                messages.Add(new
                {
                    username = entity.Username,
                    message = entity.Message,
                    type = entity.Type,
                    sentAt = entity.SentAt,
                });
            }

            // Messages are in ticks order (ascending = chronological), take last N
            return Ok(messages.TakeLast(last));
        }

        /// <summary>
        /// DELETE /chat/{year} — clears chat messages only
        /// </summary>
        [HttpDelete("{year}")]
        public async Task<IActionResult> ClearMessages(int year)
        {
            var partition = year.ToString();
            var deleted = 0;

            var chatClient = _tableStorage.GetChatMessagesClient();
            await foreach (var entity in chatClient.QueryAsync<Azure.Data.Tables.TableEntity>(
                e => e.PartitionKey == partition, select: new[] { "RowKey" }))
            {
                await chatClient.DeleteEntityAsync(partition, entity.RowKey);
                deleted++;
            }

            return Ok(new { deleted });
        }

        /// <summary>
        /// POST /chat/{year}/mark-notified — marks shotgun IDs as already notified (dedup seeding)
        /// </summary>
        [HttpPost("{year}/mark-notified")]
        public async Task<IActionResult> MarkNotified(int year, [FromBody] List<string> ids)
        {
            var notifClient = _tableStorage.GetTableClient("ShotgunNotifications");
            var partition = year.ToString();
            foreach (var id in ids)
            {
                await notifClient.UpsertEntityAsync(new Azure.Data.Tables.TableEntity(partition, id));
            }
            return Ok(new { marked = ids.Count });
        }
    }
}
