using Azure;
using Azure.Data.Tables;

namespace MastersScores.Models
{
    /// <summary>
    /// Stores shotgun state per year.
    /// PartitionKey = year, RowKey = "state"
    /// </summary>
    public class ShotgunStateEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = default!;
        public string RowKey { get; set; } = "state";
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        /// <summary>JSON array of completed shotgun IDs</summary>
        public string CompletedIds { get; set; } = "[]";

        /// <summary>Owner name the tits shotgun was assigned to (empty = not yet assigned)</summary>
        public string TitsAssignedTo { get; set; } = "";
    }
}
