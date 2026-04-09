using Azure;
using Azure.Data.Tables;
using MastersScores.Models;
using MastersScores.Services;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace MastersScores.Hubs
{
    public class ChatHub : Hub
    {
        private readonly TableClient _chatClient;
        private readonly TableClient _notificationsClient;
        private static readonly ConcurrentDictionary<string, string> ConnectedUsers = new();

        public ChatHub(TableStorageService tableStorage)
        {
            _chatClient = tableStorage.GetChatMessagesClient();
            _notificationsClient = tableStorage.GetTableClient("ShotgunNotifications");
        }

        public async Task JoinChat(string username, int year)
        {
            ConnectedUsers[Context.ConnectionId] = username;
            await Clients.All.SendAsync("UserCountChanged", ConnectedUsers.Values.Distinct().Count());

            var sentAt = DateTimeOffset.UtcNow;
            var entity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = sentAt.Ticks.ToString("D20"),
                Username = "System",
                Message = $"{username} joined the chat",
                Type = "system",
                SentAt = sentAt,
            };
            await _chatClient.UpsertEntityAsync(entity);

            await Clients.Others.SendAsync("ReceiveMessage", new
            {
                username = "System",
                message = $"{username} joined the chat",
                type = "system",
                sentAt,
            });
        }

        public async Task ChangeName(string oldName, string newName, int year)
        {
            ConnectedUsers[Context.ConnectionId] = newName;
            await Clients.All.SendAsync("UserCountChanged", ConnectedUsers.Values.Distinct().Count());

            var sentAt = DateTimeOffset.UtcNow;
            var entity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = sentAt.Ticks.ToString("D20"),
                Username = "System",
                Message = $"{oldName} is now {newName}",
                Type = "system",
                SentAt = sentAt,
            };
            await _chatClient.UpsertEntityAsync(entity);

            await Clients.All.SendAsync("ReceiveMessage", new
            {
                username = "System",
                message = $"{oldName} is now {newName}",
                type = "system",
                sentAt,
            });
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            ConnectedUsers.TryRemove(Context.ConnectionId, out _);
            await Clients.All.SendAsync("UserCountChanged", ConnectedUsers.Values.Distinct().Count());
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(string username, string message, int year)
        {
            var sentAt = DateTimeOffset.UtcNow;
            var rowKey = sentAt.Ticks.ToString("D20");

            var entity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = rowKey,
                Username = username,
                Message = message,
                Type = "user",
                SentAt = sentAt,
            };

            await _chatClient.UpsertEntityAsync(entity);

            await Clients.All.SendAsync("ReceiveMessage", new
            {
                username,
                message,
                type = "user",
                sentAt,
            });
        }

        public async Task NotifyShotgun(string shotgunId, string message, int year)
        {
            try
            {
                await _notificationsClient.GetEntityAsync<TableEntity>(year.ToString(), shotgunId);
                return;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
            }

            await _notificationsClient.UpsertEntityAsync(new TableEntity(year.ToString(), shotgunId));

            var sentAt = DateTimeOffset.UtcNow;
            var chatEntity = new ChatMessageEntity
            {
                PartitionKey = year.ToString(),
                RowKey = sentAt.Ticks.ToString("D20"),
                Username = "System",
                Message = message,
                Type = "system",
                SentAt = sentAt,
            };
            await _chatClient.UpsertEntityAsync(chatEntity);

            await Clients.All.SendAsync("ReceiveMessage", new
            {
                username = "System",
                message,
                type = "system",
                sentAt,
            });
        }

        public static int GetActiveUserCount() => ConnectedUsers.Values.Distinct().Count();
    }
}
