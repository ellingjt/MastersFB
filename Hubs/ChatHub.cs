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
        private static readonly ConcurrentDictionary<string, string> ConnectedUsers = new();

        public ChatHub(TableStorageService tableStorage)
        {
            _chatClient = tableStorage.GetChatMessagesClient();
        }

        public async Task JoinChat(string username, int year)
        {
            ConnectedUsers[Context.ConnectionId] = username;
            await Clients.All.SendAsync("UserCountChanged", ConnectedUsers.Values.Distinct().Count());
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

        public static int GetActiveUserCount() => ConnectedUsers.Values.Distinct().Count();
    }
}
