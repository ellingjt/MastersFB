using Azure.Data.Tables;

namespace MastersScores.Services
{
    public class TableStorageService
    {
        private readonly TableServiceClient _serviceClient;

        public TableStorageService(TableServiceClient serviceClient)
        {
            _serviceClient = serviceClient;
        }

        public TableClient GetChatMessagesClient() => _serviceClient.GetTableClient("ChatMessages");
        public TableClient GetDraftPicksClient() => _serviceClient.GetTableClient("DraftPicks");
        public TableClient GetTableClient(string tableName) => _serviceClient.GetTableClient(tableName);

        public async Task InitializeAsync()
        {
            await _serviceClient.CreateTableIfNotExistsAsync("ChatMessages");
            await _serviceClient.CreateTableIfNotExistsAsync("DraftPicks");
            await _serviceClient.CreateTableIfNotExistsAsync("Shotguns");
            await _serviceClient.CreateTableIfNotExistsAsync("ShotgunNotifications");
            await _serviceClient.CreateTableIfNotExistsAsync("NotificationState");
            await _serviceClient.CreateTableIfNotExistsAsync("WinProbHistory");
        }
    }
}
