namespace MastersScores.Models
{
    public class YearConfig
    {
        public int Year { get; set; }
        public Dictionary<string, List<string>> DraftPicks { get; set; } = new();
        public List<ShotgunEntry> PreTournamentShotguns { get; set; } = new();
        public List<HistoryEntry> History { get; set; } = new();
    }

    public class ShotgunEntry
    {
        public string Id { get; set; } = default!;
        public string Owner { get; set; } = default!;
        public string Reason { get; set; } = default!;
        public int Count { get; set; } = 1;
    }

    public class HistoryEntry
    {
        public int Year { get; set; }
        public string First { get; set; } = default!;
        public List<string> Last { get; set; } = new();
        public string? FirstNote { get; set; }
    }
}
