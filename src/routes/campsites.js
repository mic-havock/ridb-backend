const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const { query, param, validationResult } = require("express-validator");

// Load environment variables
dotenv.config();

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// RIDB API Base URL and Key
const RIDB_BASE_URL = process.env.RIDB_BASE_URL;
const RIDB_API_KEY = process.env.RIDB_API_KEY;

// Get available campsite statuses from environment variable
const AVAILABLE_CAMPSITE_STATUSES = process.env.AVAILABLE_CAMPSITE_STATUSES
  ? process.env.AVAILABLE_CAMPSITE_STATUSES.split(",")
  : ["Available", "Open"]; // Default if not set

// Checks campsite availability
async function checkCampsiteAvailability(campsiteId, startDate, endDate) {
  console.log("Checking availability for campsite:", campsiteId);
  try {
    // Use fetchCampsiteAvailability instead of axios.get
    const response = await fetchCampsiteAvailability(campsiteId);
    const availabilityData = response.availability.availabilities;
    //console.log("Availability data:", availabilityData);
    const startDateObj = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : startDateObj;
    console.log("Start Date:", startDateObj);
    console.log("End Date:", endDateObj);
    let isReservable = true;

    // Check if this is a single date check (start date equals end date)
    const isSingleDateCheck = startDateObj.getTime() === endDateObj.getTime();

    // Loop through the date range to check availabilities
    for (
      let date = new Date(startDateObj);
      date <= endDateObj;
      date.setDate(date.getDate() + 1)
    ) {
      const formattedDate = date.toISOString().split("T")[0] + "T00:00:00Z";
      console.log("Checking availability for date:", formattedDate);

      // For single date checks, only accept "Available" status specifically
      // For date ranges, use the configurable AVAILABLE_CAMPSITE_STATUSES array
      const status = availabilityData[formattedDate];
      console.log("Status for date:", status);

      if (isSingleDateCheck) {
        if (status !== "Available") {
          console.log(
            "Single date check requires 'Available' status, found:",
            status
          );
          isReservable = false;
          break;
        }
      } else if (!AVAILABLE_CAMPSITE_STATUSES.includes(status)) {
        console.log("Availability data:", status);
        console.log("Campsite is not reservable on date:", formattedDate);
        isReservable = false;
        break;
      }
    }
    console.log("Campsite is reservable:", isReservable);
    return {
      campsiteId,
      isReservable,
    };
  } catch (error) {
    console.error("Error checking campsite availability:", error);
    throw new Error("Failed to check availability. Please try again later.");
  }
}

/**
 * Fetch all campsites under a specific facility
 * Endpoint: GET /api/facilities/:facilityId/campsites
 */
router.get(
  "/facilities/:facilityId/campsites",
  [param("facilityId").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
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
router.get(
  "/campsites/:id",
  [param("id").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
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

/**
 * Internal function to fetch campground availability for a specific month
 * @param {string} campgroundId - The ID of the campground
 * @param {string} startDate - The start date for the month (ISO format)
 * @returns {Promise<Object>} - The availability data
 */
async function fetchCampgroundMonthAvailability(campgroundId, startDate) {
  const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(
    startDate
  )}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(
      "Error checking campsite availability:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Endpoint to check campground availability for a specific month
// Example URL: https://www.recreation.gov/api/camps/availability/campground/232459/month?start_date=2025-05-01T00:00:00.000Z
router.get(
  "/campsites/:campgroundId/availability",
  [
    param("campgroundId").notEmpty().trim().escape(),
    query("startDate").isISO8601().withMessage("start_date must be a valid date"),
  ],
  validate,
  async (req, res) => {
    const { campgroundId } = req.params;
    const { startDate } = req.query; // The start_date in the query string

    try {
      const data = await fetchCampgroundMonthAvailability(
        campgroundId,
        startDate
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Error checking campsite availability" });
    }
  }
);

/**
 * Function to fetch campsite availability for a specific campsite.
 * @param {string} campsiteId - The ID of the campsite to check availability.
 * @returns {Promise<object>} - The availability data for the campsite.
 * @throws {Error} - Throws an error if the API call fails.
 */
async function fetchCampsiteAvailability(campsiteId) {
  const url = `https://www.recreation.gov/api/camps/availability/campsite/${campsiteId}/all`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    // Check if this is a rate limit error (429)
    if (error.response && error.response.status === 429) {
      // Get pause duration from environment variable or default to 120 seconds (2 minutes)
      const pauseDurationSeconds = parseInt(
        process.env.RATE_LIMIT_PAUSE_SECONDS || "120",
        10
      );
      console.log(
        `Rate limit (429) hit for campsite ${campsiteId}. Pausing for ${pauseDurationSeconds} seconds...`
      );

      // Pause execution for the specified duration
      await new Promise((resolve) =>
        setTimeout(resolve, pauseDurationSeconds * 1000)
      );

      // Try again after the pause
      console.log(`Retrying request for campsite ${campsiteId} after pause...`);
      return fetchCampsiteAvailability(campsiteId); // Recursive call to retry
    }

    console.error(
      "Error fetching campsite availability:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch campsite availability");
  }
}

// Endpoint to check availability for a specific campsite
router.get(
  "/campsites/availability/:campsiteId",
  [param("campsiteId").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { campsiteId } = req.params;

  try {
    const availabilityData = await fetchCampsiteAvailability(campsiteId);
    res.json(availabilityData);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error checking specific campsite availability" });
  }
});

module.exports = {
  router,
  checkCampsiteAvailability,
  fetchCampgroundMonthAvailability,
};
