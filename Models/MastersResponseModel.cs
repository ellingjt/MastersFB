namespace MastersScores.Models
{
    public class MastersResponse
    {
        public required IEnumerable<Player> Players { get; set; }

        public class Player
        {
            public string FullName { get; set; }
            public string Round1 { get; set; }
            public string Round2 { get; set; }
            public string Round3 { get; set; }
            public string Round4 { get; set; }
            public string TeeTime { get; set; }
            public string ToPar { get; set; }
            public string Status { get; set; }
        }
    }

    public class TournamentState
    {
        public int CurrentRound { get; set; }
        public List<MastersResponse.Player> Players { get; set; } = new();
        public int? ProjectedCutLine { get; set; }
    }


}
