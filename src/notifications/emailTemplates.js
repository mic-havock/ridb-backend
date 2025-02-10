/**
 * Email templates for notification messages
 * Contains subject and body templates for different notification types
 */
const emailTemplates = {
  success: {
    subject:
      "{campsite_name} {campsite_number} is Available for Your Dates! 🏕️",
    body: `Great news! The campsite you're interested in is now available!

Campsite Details:
- Campground: {campsite_name}
- Campsite: {campsite_number}
- Dates Available: {start_date} through {end_date}

Book now at: https://www.recreation.gov/camping/campsites/{campsite_id}

Don't wait - available campsites can be booked quickly!

Happy Camping! 🏕️

---
To stop receiving these alerts, click here:
{base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}`,
  },
};

module.exports = emailTemplates;
