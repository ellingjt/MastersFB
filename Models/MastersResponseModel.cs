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
        }
    }


}
