# RIDB Backend - Camping Reservation Monitoring System

A comprehensive backend system for camping facility search, campsite availability monitoring, and reservation management. Provides both **REST API** and **Model Context Protocol (MCP)** interfaces for maximum flexibility.

## Overview

This system integrates with:
- **RIDB (Recreation Information Database) API** - For facility and campsite data
- **Recreation.gov API** - For real-time availability checking
- **Email notifications** - For availability alerts
- **SQLite database** - For reservation monitoring persistence

## Features

### Core Functionality
- 🏕️ Search camping facilities by location, state, or name
- 📍 Location-based search with radius filtering
- 🗓️ Real-time campsite availability checking
- 📧 Email notifications when campsites become available
- 📊 User reservation tracking and statistics
- 🔄 Automated reservation monitoring with cron jobs
- 🚦 Automatic rate limit handling with retry logic

### Dual Interface Support
- **REST API** - Traditional HTTP endpoints for web/mobile applications
- **MCP Server** - AI agent integration for conversational interfaces

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- RIDB API key (from [ridb.recreation.gov](https://ridb.recreation.gov/))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ridb-backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
```env
# RIDB API Configuration
RIDB_BASE_URL=https://ridb.recreation.gov/api/v1
RIDB_API_KEY=your_ridb_api_key_here

# Server Configuration
PORT=3000
EXTERNAL_BASE_URL=http://localhost:3000

# Email Configuration (for notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Availability Configuration
AVAILABLE_CAMPSITE_STATUSES=Available,Open
RATE_LIMIT_PAUSE_SECONDS=120
```

4. Initialize the database:
```bash
node db/initialize.js
```

### Running the Application

#### REST API Server
```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

The REST API will be available at `http://localhost:3000`

#### MCP Server (for AI Agents)
```bash
# Production
npm run mcp

# Development (with auto-restart)
npm run mcp:dev
```

See [MCP_README.md](./MCP_README.md) for detailed MCP server documentation.

## REST API Endpoints

### Facilities

#### Search Facilities
```http
GET /api/facilities?query=Yosemite&state=CA&limit=10
```

**Query Parameters:**
- `query` - Facility name search
- `state` - Two-letter state code
- `latitude` - Location latitude
- `longitude` - Location longitude
- `radius` - Search radius in miles
- `limit` - Results per page (default: 100)
- `offset` - Pagination offset (default: 0)

#### Get Facility Details
```http
GET /api/facilities/:id
```

#### Get Facility Address
```http
GET /api/facilities/:facilityId/addresses
```

### Campsites

#### Get Facility Campsites
```http
GET /api/facilities/:facilityId/campsites
```

#### Get Campsite Details
```http
GET /api/campsites/:id
```

#### Check Campsite Availability
```http
GET /api/campsites/availability/:campsiteId
```

#### Check Campground Monthly Availability
```http
GET /api/campsites/:campgroundId/availability?startDate=2025-06-01T00:00:00.000Z
```

### Reservations

#### Create Reservation Monitor
```http
POST /api/reservations
Content-Type: application/json

{
  "name": "John Doe",
  "email_address": "john@example.com",
  "campsite_id": "12345",
  "campsite_name": "Upper Pines",
  "facility_id": "232447",
  "campsite_number": "42",
  "reservation_start_date": "2025-06-15",
  "reservation_end_date": "2025-06-18",
  "monitoring_active": true,
  "attempts_made": 0,
  "success_sent": false
}
```

#### Create Bulk Reservation Monitors
```http
POST /api/reservations/bulk
Content-Type: application/json

{
  "reservations": [
    { /* reservation object 1 */ },
    { /* reservation object 2 */ }
  ]
}
```

#### Disable Monitoring
```http
GET /api/reservations/disable-monitoring/:id/:email
```

### User Management

#### Get User Reservations
```http
GET /api/user/reservations?email=john@example.com
```

#### Get Active Reservations
```http
GET /api/user/reservations/active?email=john@example.com
```

#### Update Monitoring Status
```http
PATCH /api/user/reservations/:id/monitoring
Content-Type: application/json

{
  "active": true
}
```

#### Update Reservation Dates
```http
PATCH /api/user/reservations/:id/dates
Content-Type: application/json

{
  "startDate": "2025-06-15",
  "endDate": "2025-06-18"
}
```

#### Soft Delete Reservation
```http
PATCH /api/user/reservations/:id/user-delete
```

#### Delete Reservation
```http
DELETE /api/user/reservations/:id
```

#### Get User Statistics
```http
GET /api/user/stats?email=john@example.com
```

#### Get Active User Statistics
```http
GET /api/user/stats/active?email=john@example.com
```

#### Batch Update Monitoring
```http
PATCH /api/user/reservations/batch/monitoring
Content-Type: application/json

{
  "email": "john@example.com",
  "active": true,
  "ids": [1, 2, 3]  // optional, updates all if omitted
}
```

## MCP Server (AI Agent Interface)

The Model Context Protocol server provides a standardized interface for AI agents to interact with the camping system.

### Available Tools

1. **search_facilities** - Search for camping facilities
2. **get_facility** - Get facility details
3. **get_facility_campsites** - List campsites at a facility
4. **get_campsite_details** - Get campsite information
5. **check_campsite_availability** - Check availability for dates
6. **get_campground_availability** - Get monthly availability calendar
7. **get_facility_address** - Get facility location

### Configuration for AI Clients

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ridb-camping": {
      "command": "node",
      "args": ["/absolute/path/to/ridb-backend/src/mcpServer.js"],
      "env": {
        "RIDB_BASE_URL": "https://ridb.recreation.gov/api/v1",
        "RIDB_API_KEY": "your_actual_api_key_here"
      }
    }
  }
}
```

#### Other MCP Clients

Use the stdio transport with:
```bash
node src/mcpServer.js
```

For complete MCP documentation, see [MCP_README.md](./MCP_README.md).

## Testing

### Test MCP Server
```bash
npm run test:mcp
```

This runs a comprehensive test suite that verifies:
- Server initialization
- Tool listing and execution
- Resource access
- Prompt generation

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
│  ┌─────────────────┐     ┌────────────────────┐    │
│  │  Web/Mobile App │     │   AI Agent (MCP)   │    │
│  └────────┬────────┘     └─────────┬──────────┘    │
└───────────┼──────────────────────────┼──────────────┘
            │                          │
            │ HTTP/REST                │ stdio/MCP
            │                          │
┌───────────┴──────────────────────────┴──────────────┐
│              RIDB Backend Server                     │
│  ┌─────────────────┐     ┌────────────────────┐    │
│  │  Express REST   │     │    MCP Server      │    │
│  │     API         │     │                    │    │
│  └────────┬────────┘     └─────────┬──────────┘    │
│           │                        │                │
│           └────────┬───────────────┘                │
│                    │                                │
│         ┌──────────┴──────────┐                     │
│         │  Business Logic     │                     │
│         │  - Availability     │                     │
│         │  - Reservations     │                     │
│         │  - Notifications    │                     │
│         └──────────┬──────────┘                     │
└────────────────────┼───────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────┴────────┐    ┌──────────┴─────────┐
│  External APIs │    │  Local Database    │
│  - RIDB API    │    │  - SQLite          │
│  - Rec.gov API │    │  - Reservations    │
└────────────────┘    └────────────────────┘
```

### Data Flow

1. **Facility Search**: Client → Backend → RIDB API → Backend → Client
2. **Availability Check**: Client → Backend → Recreation.gov → Backend → Client
3. **Reservation Monitor**: Client → Backend → Database → Cron Job → Recreation.gov → Email

### Background Processing

The reservation monitor runs as a background process:
- Checks configured reservations on a schedule
- Queries Recreation.gov for availability
- Sends email notifications when campsites become available
- Handles rate limiting automatically

## Rate Limiting

Both RIDB and Recreation.gov APIs have rate limits. The system handles this by:

1. **Detection**: Identifies HTTP 429 (Too Many Requests) responses
2. **Pause**: Waits for a configurable duration (default: 120 seconds)
3. **Retry**: Automatically retries the request
4. **Configuration**: Adjust `RATE_LIMIT_PAUSE_SECONDS` in `.env`

## Email Notifications

The system sends email notifications for:
- Reservation monitoring confirmation
- Campsite availability alerts
- Bulk reservation confirmations

Configure email settings in `.env`:
```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password  # Use app-specific password for Gmail
```

## Database Schema

### Reservations Table

```sql
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  campsite_id TEXT NOT NULL,
  campsite_name TEXT,
  facility_id TEXT,
  campsite_number TEXT,
  reservation_start_date TEXT NOT NULL,
  reservation_end_date TEXT NOT NULL,
  monitoring_active INTEGER DEFAULT 1,
  attempts_made INTEGER DEFAULT 0,
  success_sent INTEGER DEFAULT 0,
  user_deleted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Error Handling

The system includes comprehensive error handling for:

- **API Errors**: Detailed error messages from RIDB and Recreation.gov
- **Rate Limiting**: Automatic retry with exponential backoff
- **Network Failures**: Graceful degradation with error responses
- **Invalid Input**: Validation errors with clear messages
- **Database Errors**: Transaction rollback and error logging

## Security Considerations

1. **API Keys**: Never commit `.env` files. Use environment variables in production.
2. **Email Credentials**: Use app-specific passwords, not main account passwords.
3. **CORS**: Configure `corsOptions` in `src/server.js` for your frontend domains.
4. **Input Validation**: All user inputs are validated using `express-validator`.
5. **SQL Injection**: Uses parameterized queries throughout.

## Development

### Project Structure

```
ridb-backend/
├── src/
│   ├── server.js              # REST API server
│   ├── mcpServer.js           # MCP server for AI agents
│   ├── routes/
│   │   ├── campsites.js       # Campsite endpoints
│   │   ├── facilities.js      # Facility endpoints
│   │   ├── location.js        # Location endpoints
│   │   ├── reservations.js    # Reservation endpoints
│   │   └── user.js            # User management endpoints
│   ├── notifications/
│   │   ├── emails.js          # Email notification handler
│   │   └── notificationsTemplate.js  # Email templates
│   └── reservationMonitor/
│       └── reservationMonitor.js  # Background monitoring process
├── db/
│   ├── initialize.js          # Database initialization
│   └── insertTestData.js      # Test data seeding
├── test-mcp.js                # MCP server test suite
├── mcp-config.example.json    # Example MCP configuration
├── .env.example               # Example environment variables
├── package.json               # Dependencies and scripts
├── README.md                  # This file
└── MCP_README.md              # Detailed MCP documentation
```

### Adding Features

#### Adding a REST Endpoint

1. Add route handler in appropriate file in `src/routes/`
2. Register route in `src/server.js`
3. Update this README

#### Adding an MCP Tool

1. Add tool definition in `ListToolsRequestSchema` handler
2. Implement tool logic in `CallToolRequestSchema` handler
3. Update `MCP_README.md`

## Troubleshooting

### Common Issues

#### "Error: RIDB_API_KEY not configured"
**Solution**: Ensure your `.env` file exists and contains a valid API key.

#### "ECONNREFUSED" errors
**Solution**: Check that external APIs are accessible. Verify network connectivity.

#### Rate limit errors (429)
**Solution**: Increase `RATE_LIMIT_PAUSE_SECONDS` or reduce request frequency.

#### Email notifications not sending
**Solution**: 
- Verify `EMAIL_USER` and `EMAIL_PASS` in `.env`
- For Gmail, use an app-specific password
- Check that less secure app access is enabled (if applicable)

## API Keys

### RIDB API Key

Get your free API key at [ridb.recreation.gov](https://ridb.recreation.gov/)

The RIDB API provides:
- Facility information
- Campsite details
- Organizational data
- Geographic information

### Recreation.gov

Recreation.gov API is used for:
- Real-time availability checking
- Campground availability calendars

No separate API key is required for Recreation.gov endpoints.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Specify your license here]

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review API documentation:
  - [RIDB API Docs](https://ridb.recreation.gov/)
  - [MCP Protocol](https://modelcontextprotocol.io/)

## Acknowledgments

- Recreation Information Database (RIDB) API
- Recreation.gov for availability data
- Model Context Protocol for AI agent integration standards
