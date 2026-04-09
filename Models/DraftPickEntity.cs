using Azure;
using Azure.Data.Tables;

namespace MastersScores.Models
{
    /// <summary>
    /// PartitionKey = tournament year (e.g. "2026")
    /// RowKey = "{OwnerName}_{PickNumber}" (e.g. "Josh_1")
    /// </summary>
    public class DraftPickEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = default!;  // Year
        public string RowKey { get; set; } = default!;         // Owner_PickNumber
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        public string OwnerName { get; set; } = default!;
        public string GolferName { get; set; } = default!;
        public int PickNumber { get; set; }
    }
}
