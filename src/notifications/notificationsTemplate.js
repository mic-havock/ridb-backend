/**
 * Email templates for notification messages
 * Contains subject and body templates for different notification types
 */
const notificationsTemplate = {
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
To stop receiving these alerts, visit: {base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Great news! The campsite you're interested in is now available!</h2>

  <div style="margin: 20px 0;">
    <strong>Campsite Details:</strong>
    <ul>
      <li>Campground: {campsite_name}</li>
      <li>Campsite: {campsite_number}</li>
      <li>Dates Available: {start_date} through {end_date}</li>
    </ul>
  </div>

  <p><a href="https://www.recreation.gov/camping/campsites/{campsite_id}" style="display: inline-block; background-color: #2c7744; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Book Now</a></p>

  <p>Don't wait - available campsites can be booked quickly!</p>

  <p>Happy Camping! 🏕️</p>

  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #666;">
    To stop receiving these alerts click <a href="{base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}">here</a>
  </p>
</div>`,
  },

  confirmation: {
    subject:
      "Campsite Alert Confirmed for {campsite_name} {campsite_number} 🏕️",
    body: `Your campsite alert has been successfully created!

We'll monitor availability for:
- Campground: {campsite_name}
- Campsite: {campsite_number}
- Dates Requested: {start_date} through {end_date}

You'll receive an email as soon as this campsite becomes available for your dates.

View the campsite: https://www.recreation.gov/camping/campsites/{campsite_id}

---
To stop receiving these alerts, visit: {base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}

Happy Camping! 🏕️`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Your campsite alert has been successfully created!</h2>

  <div style="margin: 20px 0;">
    <strong>We'll monitor availability for:</strong>
    <ul>
      <li>Campground: {campsite_name}</li>
      <li>Campsite: {campsite_number}</li>
      <li>Dates Requested: {start_date} through {end_date}</li>
    </ul>
  </div>

  <p>You'll receive an email as soon as this campsite becomes available for your dates.</p>

  <p><a href="https://www.recreation.gov/camping/campsites/{campsite_id}" style="display: inline-block; background-color: #2c7744; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Campsite</a></p>

  <p>Happy Camping! 🏕️</p>

  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #666;">
    To stop receiving these alerts click <a href="{base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}">here</a>
  </p>
</div>`,
  },

  bulkConfirmation: {
    subject: "Multiple Campsite Alerts Confirmed! 🏕️",
    body: `Your campsite alerts have been successfully created!

We'll monitor availability for the following campsites:
{campsite_list}

You'll receive individual emails as soon as any of these campsites become available for your dates.

Happy Camping! 🏕️

---
To stop receiving these alerts, visit: https://kampscout.com/reservation-management`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Your campsite alerts have been successfully created! 🎉</h2>

  <div style="margin: 20px 0;">
    <strong>We'll monitor availability for:</strong>
    <ul>
      {campsite_list_html}
    </ul>
  </div>

  <p>You'll receive individual emails as soon as any of these campsites become available for your dates.</p>

  <p>Happy Camping! 🏕️</p>

  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #666;">
    To stop receiving these alerts click <a href="https://kampscout.com/reservation-management">here</a>
  </p>
</div>`,
  },
};

// Add HTML templates for web responses
const htmlTemplates = {
  monitoringDisabled: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Monitoring Disabled</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          text-align: center;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          margin-top: 40px;
        }
        h1 {
          color: #2c7744;
          margin-bottom: 20px;
        }
        p {
          font-size: 18px;
          margin-bottom: 25px;
        }
        .icon {
          font-size: 48px;
          margin-bottom: 20px;
          color: #2c7744;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✓</div>
        <h1>Monitoring Disabled Successfully</h1>
        <p>You have successfully disabled monitoring for your campsite reservation.</p>
        <p>You will no longer receive notifications about this reservation.</p>
      </div>
    </body>
    </html>
  `,
};

module.exports = {
  confirmation: notificationsTemplate.confirmation,
  availabilityFound: notificationsTemplate.success,
  bulkConfirmation: notificationsTemplate.bulkConfirmation,
  htmlTemplates,
};
