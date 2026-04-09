using Azure;
using Azure.Data.Tables;

namespace MastersScores.Models
{
    /// <summary>
    /// PartitionKey = year (e.g. "2026")
    /// RowKey = inverted ticks for chronological ordering (newest last when queried ascending)
    /// </summary>
    public class ChatMessageEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = default!;
        public string RowKey { get; set; } = default!;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        public string Username { get; set; } = default!;
        public string Message { get; set; } = default!;
        public string Type { get; set; } = "user"; // "user" or "system"
        public DateTimeOffset SentAt { get; set; }
    }
}
