const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load environment variables from the project root
// This ensures .env is found even when the process is spawned from a different directory
// __dirname is /path/to/ridb-backend/src, so we go up one level to the project root
const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

// RIDB API Configuration
const RIDB_BASE_URL = process.env.RIDB_BASE_URL;
const RIDB_API_KEY = process.env.RIDB_API_KEY;

// Verify required environment variables
if (!RIDB_BASE_URL || !RIDB_API_KEY) {
  console.error("ERROR: Missing required environment variables");
  console.error(`  RIDB_BASE_URL: ${RIDB_BASE_URL ? "✓" : "✗ MISSING"}`);
  console.error(`  RIDB_API_KEY: ${RIDB_API_KEY ? "✓" : "✗ MISSING"}`);
  console.error(`  .env path: ${envPath}`);
  console.error(`  .env exists: ${fs.existsSync(envPath) ? "yes" : "NO"}`);
  process.exit(1);
}
const AVAILABLE_CAMPSITE_STATUSES = process.env.AVAILABLE_CAMPSITE_STATUSES
  ? process.env.AVAILABLE_CAMPSITE_STATUSES.split(",")
  : ["Available", "Open"];

/**
 * Fetches campsite availability from Recreation.gov API
 * @param {string} campsiteId - The campsite ID to check
 * @returns {Promise<object>} Availability data
 */
async function fetchCampsiteAvailability(campsiteId) {
  const url = `https://www.recreation.gov/api/camps/availability/campsite/${campsiteId}/all`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    // Handle rate limiting
    if (error.response && error.response.status === 429) {
      const pauseDurationSeconds = parseInt(
        process.env.RATE_LIMIT_PAUSE_SECONDS || "120",
        10
      );
      console.error(
        `Rate limit (429) hit for campsite ${campsiteId}. Pausing for ${pauseDurationSeconds} seconds...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, pauseDurationSeconds * 1000)
      );
      return fetchCampsiteAvailability(campsiteId);
    }

    console.error(
      "Error fetching campsite availability:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch campsite availability");
  }
}

/**
 * Checks campsite availability for a date range
 * @param {string} campsiteId - The campsite ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD) optional
 * @returns {Promise<object>} Availability check result
 */
async function checkCampsiteAvailability(campsiteId, startDate, endDate) {
  try {
    const response = await fetchCampsiteAvailability(campsiteId);
    const availabilityData = response.availability.availabilities;
    const startDateObj = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : startDateObj;
    let isReservable = true;

    const isSingleDateCheck = startDateObj.getTime() === endDateObj.getTime();

    for (
      let date = new Date(startDateObj);
      date <= endDateObj;
      date.setDate(date.getDate() + 1)
    ) {
      const formattedDate = date.toISOString().split("T")[0] + "T00:00:00Z";
      const status = availabilityData[formattedDate];

      if (isSingleDateCheck) {
        if (status !== "Available") {
          isReservable = false;
          break;
        }
      } else if (!AVAILABLE_CAMPSITE_STATUSES.includes(status)) {
        isReservable = false;
        break;
      }
    }

    return {
      campsiteId,
      isReservable,
      startDate,
      endDate: endDate || startDate,
    };
  } catch (error) {
    console.error("Error checking campsite availability:", error);
    throw new Error("Failed to check availability. Please try again later.");
  }
}

/**
 * Creates and starts the MCP server
 */
async function startMCPServer() {
  const server = new Server(
    {
      name: "ridb-camping-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  /**
   * Handler for listing available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_facilities",
          description:
            "Search for camping facilities by location, state, or other criteria. Returns a list of facilities with their details.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for facility name",
              },
              state: {
                type: "string",
                description: "Two-letter state code (e.g., CA, NY)",
              },
              latitude: {
                type: "number",
                description: "Latitude for location-based search",
              },
              longitude: {
                type: "number",
                description: "Longitude for location-based search",
              },
              radius: {
                type: "number",
                description: "Search radius in miles (requires lat/long)",
              },
              limit: {
                type: "number",
                description: "Maximum number of results (default: 100)",
              },
              offset: {
                type: "number",
                description: "Offset for pagination (default: 0)",
              },
            },
          },
        },
        {
          name: "get_facility",
          description:
            "Get detailed information about a specific camping facility by its ID.",
          inputSchema: {
            type: "object",
            properties: {
              facilityId: {
                type: "string",
                description: "The unique ID of the facility",
              },
            },
            required: ["facilityId"],
          },
        },
        {
          name: "get_facility_campsites",
          description:
            "Get all campsites available at a specific facility. Returns detailed information about each campsite.",
          inputSchema: {
            type: "object",
            properties: {
              facilityId: {
                type: "string",
                description: "The unique ID of the facility",
              },
            },
            required: ["facilityId"],
          },
        },
        {
          name: "get_campsite_details",
          description:
            "Get detailed information about a specific campsite including amenities, capacity, and restrictions.",
          inputSchema: {
            type: "object",
            properties: {
              campsiteId: {
                type: "string",
                description: "The unique ID of the campsite",
              },
            },
            required: ["campsiteId"],
          },
        },
        {
          name: "check_campsite_availability",
          description:
            "Check if a campsite is available for specific dates. Returns availability status for the date range.",
          inputSchema: {
            type: "object",
            properties: {
              campsiteId: {
                type: "string",
                description: "The unique ID of the campsite",
              },
              startDate: {
                type: "string",
                description:
                  "Start date in YYYY-MM-DD format (e.g., 2025-06-15)",
              },
              endDate: {
                type: "string",
                description:
                  "End date in YYYY-MM-DD format (optional, defaults to start date)",
              },
            },
            required: ["campsiteId", "startDate"],
          },
        },
        {
          name: "get_campground_availability",
          description:
            "Get availability for all campsites in a campground for a specific month. Returns detailed availability calendar.",
          inputSchema: {
            type: "object",
            properties: {
              campgroundId: {
                type: "string",
                description: "The unique ID of the campground/facility",
              },
              startDate: {
                type: "string",
                description:
                  "Start date for the month in ISO format (e.g., 2025-06-01T00:00:00.000Z)",
              },
            },
            required: ["campgroundId", "startDate"],
          },
        },
        {
          name: "get_facility_address",
          description:
            "Get the physical address and location details for a facility.",
          inputSchema: {
            type: "object",
            properties: {
              facilityId: {
                type: "string",
                description: "The unique ID of the facility",
              },
            },
            required: ["facilityId"],
          },
        },
      ],
    };
  });

  /**
   * Handler for executing tools
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "search_facilities": {
          const {
            query = "",
            state = "",
            latitude = "",
            longitude = "",
            radius = "",
            limit = 100,
            offset = 0,
          } = args;

          const url = `${RIDB_BASE_URL}/facilities`;
          const params = {
            query,
            limit,
            offset,
            state,
            latitude,
            longitude,
            radius,
            activity: "CAMPING",
            sort: "NAME",
          };

          const response = await axios.get(url, {
            params,
            headers: { apikey: RIDB_API_KEY },
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        case "get_facility": {
          const { facilityId } = args;

          if (!facilityId) {
            throw new Error("facilityId is required");
          }

          const response = await axios.get(
            `${RIDB_BASE_URL}/facilities/${facilityId}`,
            {
              headers: { apikey: RIDB_API_KEY },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        case "get_facility_campsites": {
          const { facilityId } = args;

          if (!facilityId) {
            throw new Error("facilityId is required");
          }

          const response = await axios.get(
            `${RIDB_BASE_URL}/facilities/${facilityId}/campsites`,
            {
              headers: { apikey: RIDB_API_KEY },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        case "get_campsite_details": {
          const { campsiteId } = args;

          if (!campsiteId) {
            throw new Error("campsiteId is required");
          }

          const response = await axios.get(
            `${RIDB_BASE_URL}/campsites/${campsiteId}`,
            {
              headers: { apikey: RIDB_API_KEY },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        case "check_campsite_availability": {
          const { campsiteId, startDate, endDate } = args;

          if (!campsiteId || !startDate) {
            throw new Error("campsiteId and startDate are required");
          }

          const result = await checkCampsiteAvailability(
            campsiteId,
            startDate,
            endDate
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_campground_availability": {
          const { campgroundId, startDate } = args;

          if (!campgroundId || !startDate) {
            throw new Error("campgroundId and startDate are required");
          }

          const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(
            startDate
          )}`;

          const response = await axios.get(url);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        case "get_facility_address": {
          const { facilityId } = args;

          if (!facilityId) {
            throw new Error("facilityId is required");
          }

          const response = await axios.get(
            `${RIDB_BASE_URL}/facilities/${facilityId}/facilityaddresses`,
            {
              headers: { apikey: RIDB_API_KEY },
            }
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: error.message,
                details: error.response?.data || null,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Handler for listing available resources
   */
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "ridb://facilities/search",
          name: "Facility Search",
          description:
            "Search and browse camping facilities across the Recreation Information Database",
          mimeType: "application/json",
        },
        {
          uri: "ridb://campsites/availability",
          name: "Campsite Availability",
          description: "Real-time availability data for campsites",
          mimeType: "application/json",
        },
      ],
    };
  });

  /**
   * Handler for reading resources
   */
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      switch (uri) {
        case "ridb://facilities/search": {
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    description:
                      "Search camping facilities using the RIDB API",
                    availableParameters: {
                      query: "Facility name search",
                      state: "Two-letter state code",
                      latitude: "Location latitude",
                      longitude: "Location longitude",
                      radius: "Search radius in miles",
                    },
                    example:
                      "Use the search_facilities tool to search for facilities",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "ridb://campsites/availability": {
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    description:
                      "Check real-time campsite availability from Recreation.gov",
                    availableTools: [
                      "check_campsite_availability",
                      "get_campground_availability",
                    ],
                    example:
                      "Use check_campsite_availability tool with a campsite ID and date range",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  });

  /**
   * Handler for listing available prompts
   */
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "find_camping",
          description:
            "Help find camping facilities based on location or preferences",
          arguments: [
            {
              name: "location",
              description:
                "Location to search (city, state, or coordinates)",
              required: true,
            },
            {
              name: "dates",
              description: "Desired camping dates (optional)",
              required: false,
            },
          ],
        },
        {
          name: "check_availability",
          description: "Check availability for a specific campsite or facility",
          arguments: [
            {
              name: "facilityName",
              description: "Name of the camping facility",
              required: true,
            },
            {
              name: "startDate",
              description: "Check-in date (YYYY-MM-DD)",
              required: true,
            },
            {
              name: "endDate",
              description: "Check-out date (YYYY-MM-DD)",
              required: false,
            },
          ],
        },
        {
          name: "plan_camping_trip",
          description:
            "Get comprehensive help planning a camping trip including facility search, availability checking, and recommendations",
          arguments: [
            {
              name: "destination",
              description: "Desired camping destination or region",
              required: true,
            },
            {
              name: "duration",
              description: "Length of stay (e.g., 2 nights, 1 week)",
              required: false,
            },
            {
              name: "preferences",
              description:
                "Camping preferences (e.g., RV sites, tent camping, amenities)",
              required: false,
            },
          ],
        },
      ],
    };
  });

  /**
   * Handler for getting prompt content
   */
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "find_camping": {
        const { location, dates } = args;
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I'm looking for camping facilities near ${location}${
                  dates ? ` for ${dates}` : ""
                }. Can you help me search for available options and provide details about the facilities?`,
              },
            },
          ],
        };
      }

      case "check_availability": {
        const { facilityName, startDate, endDate } = args;
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to check availability at ${facilityName} from ${startDate}${
                  endDate ? ` to ${endDate}` : ""
                }. Can you search for this facility and check which campsites are available during this period?`,
              },
            },
          ],
        };
      }

      case "plan_camping_trip": {
        const { destination, duration, preferences } = args;
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I'm planning a camping trip to ${destination}${
                  duration ? ` for ${duration}` : ""
                }. ${
                  preferences ? `My preferences include: ${preferences}. ` : ""
                }Can you help me find suitable camping facilities, check their availability, and provide recommendations?`,
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // Start the server using stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("RIDB Camping MCP Server running on stdio");
}

// Start the server
startMCPServer().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
