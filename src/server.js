const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const startReservationMonitor = require("./reservationMonitor/reservationMonitor"); // Import monitoring process

// Load environment variables
dotenv.config();

// Import routes
const facilitiesRouter = require("../src/routes/facilities");
const { router: campsitesRouter } = require("../src/routes/campsites");
const locationRouter = require("../src/routes/location");
const reservationsRouter = require("../src/routes/reservations");
const userRouter = require("../src/routes/user"); // Import user routes

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());

// CORS configuration - explicitly allow production and development origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }

    // List of allowed origins
    const allowedOrigins = [
      "https://kampscout.com",
      "https://www.kampscout.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ];

    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In development, allow all origins for flexibility
      if (process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true, // Allow cookies and credentials
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

// Enable CORS with explicit configuration
app.use(cors(corsOptions));

// Use routes
app.use("/api", facilitiesRouter);
app.use("/api", campsitesRouter);
app.use("/api", locationRouter);
app.use("/api/reservations", reservationsRouter); // Mount reservations endpoints
app.use("/api/user", userRouter); // Mount user endpoints

// Default route to check if the server is running
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Start the reservation monitoring process
startReservationMonitor();
