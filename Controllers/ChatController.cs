using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

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
        /// POST /chat/{year}/delete-matching — deletes messages containing any of the given substrings
        /// </summary>
        [HttpPost("{year}/delete-matching")]
        public async Task<IActionResult> DeleteMatching(int year, [FromBody] List<string> substrings)
        {
            var partition = year.ToString();
            var deleted = 0;

            var chatClient = _tableStorage.GetChatMessagesClient();
            await foreach (var entity in chatClient.QueryAsync<ChatMessageEntity>(
                e => e.PartitionKey == partition))
            {
                if (substrings.Any(s => entity.Message.Contains(s)))
                {
                    await chatClient.DeleteEntityAsync(partition, entity.RowKey);
                    deleted++;
                }
            }

            return Ok(new { deleted });
        }

        /// <summary>
        /// POST /chat/{year}/clear-notifications-matching — removes notification dedup entries matching substrings
        /// </summary>
        [HttpPost("{year}/clear-notifications-matching")]
        public async Task<IActionResult> ClearNotificationsMatching(int year, [FromBody] List<string> substrings)
        {
            var notifClient = _tableStorage.GetTableClient("ShotgunNotifications");
            var partition = year.ToString();
            var deleted = 0;

            await foreach (var entity in notifClient.QueryAsync<Azure.Data.Tables.TableEntity>(
                e => e.PartitionKey == partition))
            {
                if (substrings.Any(s => entity.RowKey.Contains(s)))
                {
                    await notifClient.DeleteEntityAsync(partition, entity.RowKey);
                    deleted++;
                }
            }

            return Ok(new { deleted });
        }

        /// <summary>
        /// POST /chat/{year}/send-system — posts a system message to chat (admin)
        /// </summary>
        [HttpPost("{year}/send-system")]
        public async Task<IActionResult> SendSystemMessage(int year, [FromBody] SystemMessageRequest request,
            [FromServices] Microsoft.AspNetCore.SignalR.IHubContext<Hubs.ChatHub> hubContext)
        {
            var sentAt = DateTimeOffset.UtcNow;
            var entity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = sentAt.Ticks.ToString("D20"),
                Username = "System",
                Message = request.Message,
                Type = "system",
                SentAt = sentAt,
            };
            var chatClient = _tableStorage.GetChatMessagesClient();
            await chatClient.UpsertEntityAsync(entity);

            await hubContext.Clients.All.SendAsync("ReceiveMessage", new
            {
                username = "System",
                message = request.Message,
                type = "system",
                sentAt,
            });

            return Ok(new { sent = true });
        }

        public class SystemMessageRequest
        {
            public string Message { get; set; } = default!;
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
