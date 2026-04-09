namespace MastersScores.Models
{
    // Root myDeserializedClass = JsonConvert.DeserializeObject<Root>(myJsonResponse);
    public class Data
    {
        public string currentRound { get; set; }
        public string wallClockTime { get; set; }
        public string statusRound { get; set; }
        public Yardages yardages { get; set; }
        public Pars pars { get; set; }
        public List<Player> player { get; set; }
    }

    public class Pars
    {
        public List<int> round1 { get; set; }
        public List<int> round2 { get; set; }
        public List<object> round3 { get; set; }
        public List<object> round4 { get; set; }
    }

    public class Player
    {
        public string id { get; set; }
        public string display_name { get; set; }
        public string display_name2 { get; set; }
        public string first_name { get; set; }
        public string last_name { get; set; }
        public string full_name { get; set; }
        public string countryName { get; set; }
        public string countryCode { get; set; }
        public string live { get; set; }
        public bool video { get; set; }
        public string pos { get; set; }
        public bool image { get; set; }
        public bool amateur { get; set; }
        public bool past { get; set; }
        public bool firsttimer { get; set; }
        public string status { get; set; }
        public string newStatus { get; set; }
        public bool active { get; set; }
        public bool us { get; set; }
        public bool intl { get; set; }
        public string teetime { get; set; }
        public string tee_order { get; set; }
        public string sort_order { get; set; }
        public string start { get; set; }
        public string group { get; set; }
        public string today { get; set; }
        public string thru { get; set; }
        public string groupHistory { get; set; }
        public string thruHistory { get; set; }
        public string lastHoleWithShot { get; set; }
        public int holeProgress { get; set; }
        public string topar { get; set; }
        public string total { get; set; }
        public string totalUnderPar { get; set; }
        public string movement { get; set; }
        public string last_highlight { get; set; }
        public Round round1 { get; set; }
        public Round round2 { get; set; }
        public Round round3 { get; set; }
        public Round round4 { get; set; }
    }

    public class Root
    {
        public string fileEpoch { get; set; }
        public Data data { get; set; }
    }

    public class Round
    {
        public object prior { get; set; }
        public int fantasy { get; set; }
        public object total { get; set; }
        public string roundStatus { get; set; }
        public string teetime { get; set; }
        public List<int?> scores { get; set; }
    }

    public class Yardages
    {
        public List<int> round1 { get; set; }
        public List<int> round2 { get; set; }
        public List<object> round3 { get; set; }
        public List<object> round4 { get; set; }
    }
}
