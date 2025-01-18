const axios = require("axios");
const cron = require("node-cron");
const { sendEmailNotification } = require("../notifications/emails");

// Example campsite IDs to check availability for
const campsiteIds = [1674];

// Function to check campsite availability
const checkCampsiteAvailability = async () => {
  try {
    for (const campsiteId of campsiteIds) {
      const url = `https://www.recreation.gov/api/camps/availability/campsite/${campsiteId}/all`;
      console.log(`Checking availability for campsite ID: ${campsiteId}`);

      const response = await axios.get(url);
      //const availability = response.data;
      const availability = true;

      // Example logic: Check if a campsite is available
      if (availability) {
        const message = `Good news! Campsite ${campsiteId} is available for reservation.`;
        console.log(message);

        // Send email notification
        await sendEmailNotification(campsiteId, message);
      } else {
        console.log(`Campsite ${campsiteId} is not available.`);
      }
    }
  } catch (error) {
    console.error("Error checking campsite availability:", error.message);
  }
};

// Schedule the cron job to run every 15 seconds
const scheduleCronJob = () => {
  cron.schedule("*/15 * * * * *", async () => {
    console.log("Running campsite availability check...");
    await checkCampsiteAvailability();
  });
};

module.exports = scheduleCronJob;
