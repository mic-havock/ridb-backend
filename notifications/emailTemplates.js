/**
 * Email templates for notification messages
 * Contains subject and body templates for different notification types
 */
const emailTemplates = {
  success: {
    subject: "Campsite {campsite_id} is Available for Your Dates! 🏕️",
    body: `Great news! The campsite you're interested in is now available!

Campsite Details:
- Campsite ID: {campsite_id}
- Dates Available: {start_date} through {end_date}

Book now at: https://www.recreation.gov/camping/campsites/{campsite_id}

Don't wait - available campsites can be booked quickly!

Happy Camping! 🏕️

---
To stop receiving these alerts, click here:
{base_url}/api/disable-monitoring/{reservation_id}`,
  },
};

module.exports = emailTemplates;
