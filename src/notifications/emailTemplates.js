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

  confirmation: {
    subject:
      "Campsite Alert Confirmed for {campsite_name} {campsite_number} 🏕️",
    body: `Your campsite alert has been successfully created!

We'll monitor availability for:
- Campground: {campsite_name}
- Campsite: {campsite_number}
- Dates Requested: {start_date} through {end_date}

You'll receive an email as soon as this campsite becomes available for your dates.

View the campsite here: https://www.recreation.gov/camping/campsites/{campsite_id}

---
To stop receiving these alerts, click here:
{base_url}/api/reservations/disable-monitoring/{reservation_id}/{email_address}

Happy Camping! 🏕️`,
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
  confirmation: emailTemplates.confirmation,
  availabilityFound: emailTemplates.success,
  htmlTemplates,
};
