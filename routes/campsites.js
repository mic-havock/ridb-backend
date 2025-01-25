const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const router = express.Router();

// RIDB API Base URL and Key
const RIDB_BASE_URL = process.env.RIDB_BASE_URL;
const RIDB_API_KEY = process.env.RIDB_API_KEY;

// Checks campsite availability
async function checkCampsiteAvailability(campsiteId) {
  // Add your logic for checking availability here (e.g., querying a database)
  const isReservable = true; // Example: Replace with actual logic
  return { campsiteId, reservable: isReservable };
}

/**
 * Fetch all campsites under a specific facility
 * Endpoint: GET /api/facilities/:facilityId/campsites
 */
router.get("/facilities/:facilityId/campsites", async (req, res) => {
  const { facilityId } = req.params;

  try {
    const response = await axios.get(
      `${RIDB_BASE_URL}facilities/${facilityId}/campsites`,
      {
        headers: { apikey: RIDB_API_KEY },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching campsites:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching campsites" });
  }
});

/**
 * Fetch details for a specific campsite
 * Endpoint: GET /api/campsites/:id
 */
router.get("/campsites/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(`${RIDB_BASE_URL}campsites/${id}`, {
      headers: { apikey: RIDB_API_KEY },
    });

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching campsite details:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching campsite details" });
  }
});

// Endpoint to check campground availability for a specific month
// Example URL: https://www.recreation.gov/api/camps/availability/campground/232459/month?start_date=2025-05-01T00:00:00.000Z
router.get("/campsites/:campgroundId/availability", async (req, res) => {
  const { campgroundId } = req.params;
  const { startDate } = req.query; // The start_date in the query string

  if (!startDate) {
    return res
      .status(400)
      .json({ message: "start_date is required in query params." });
  }

  try {
    // Construct the URL for the availability endpoint
    const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(
      startDate
    )}`;

    // Make the API call
    const response = await axios.get(url);

    // Return the availability data
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error checking campsite availability:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error checking campsite availability" });
  }
});

// Endpoint to check availability for a specific campsite
// Example URL: /api/campsites/availability/:campsiteId
router.get("/campsites/availability/:campsiteId", async (req, res) => {
  const { campsiteId } = req.params;

  try {
    // Construct the URL for the specific campsite availability endpoint
    const url = `https://www.recreation.gov/api/camps/availability/campsite/${campsiteId}/all`;

    // Make the API call to check campsite availability
    const response = await axios.get(url);

    // Return the availability data for the specific campsite
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error checking specific campsite availability:",
      error.response?.data || error.message
    );
    res
      .status(500)
      .json({ message: "Error checking specific campsite availability" });
  }
});

//module.exports = { router, checkCampsiteAvailability };
module.exports = {
  router,
  checkCampsiteAvailability,
};
