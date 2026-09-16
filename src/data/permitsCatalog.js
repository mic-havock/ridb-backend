/**
 * Curated catalog of wilderness permits supported by Kamp Scout
 * These are the target permits in Washington State
 */
const permitsCatalog = [
  {
    id: "4675317",
    name: "Mount Rainier Wilderness & Climbing",
    park: "Mount Rainier National Park",
    api_type: "itinerary",
    rec_gov_url: "https://www.recreation.gov/permits/4675317",
    detailed_availability_url: "https://www.recreation.gov/permits/4675317/registration/detailed-availability",
    description: "Overnight wilderness permits for Mount Rainier backcountry camps and climbing routes"
  },
  {
    id: "4675322",
    name: "North Cascades Backcountry",
    park: "North Cascades National Park",
    api_type: "itinerary",
    rec_gov_url: "https://www.recreation.gov/permits/4675322",
    detailed_availability_url: "https://www.recreation.gov/permits/4675322/registration/detailed-availability",
    description: "Overnight backcountry permits for North Cascades wilderness camps"
  },
  {
    id: "4098362",
    name: "Olympic NP Wilderness",
    park: "Olympic National Park",
    api_type: "itinerary",
    rec_gov_url: "https://www.recreation.gov/permits/4098362",
    detailed_availability_url: "https://www.recreation.gov/permits/4098362/registration/detailed-availability",
    description: "Overnight wilderness permits for Olympic National Park backcountry"
  },
  {
    id: "250003",
    name: "Mount Margaret Backcountry",
    park: "Mount Margaret Backcountry",
    api_type: "standard",
    rec_gov_url: "https://www.recreation.gov/permits/250003",
    detailed_availability_url: "https://www.recreation.gov/permits/250003/registration/detailed-availability",
    description: "Overnight backcountry permits for Mount Margaret area"
  },
  {
    id: "233273",
    name: "Enchantments Advanced Lottery",
    park: "Enchantments",
    api_type: "standard",
    rec_gov_url: "https://www.recreation.gov/permits/233273",
    detailed_availability_url: "https://www.recreation.gov/permits/233273/registration/detailed-availability",
    description: "Advanced lottery permits for overnight camping in the Enchantments zone"
  },
  {
    id: "445863",
    name: "Enchantments Daily Lottery",
    park: "Enchantments",
    api_type: "lottery_daily",
    rec_gov_url: "https://www.recreation.gov/permits/445863",
    detailed_availability_url: "https://www.recreation.gov/permits/445863/registration/detailed-availability",
    description: "Daily lottery for day-before overnight permits in the Enchantments (geofenced - lottery window reminders only)"
  }
];

module.exports = permitsCatalog;
