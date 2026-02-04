# RIDB Camping MCP Server

This Model Context Protocol (MCP) server provides AI agents with access to the Recreation Information Database (RIDB) and Recreation.gov camping data. It exposes tools, resources, and prompts that allow AI assistants to help users find camping facilities, check availability, and plan camping trips.

## Overview

The MCP server runs alongside your REST API and provides a standardized interface for AI agents to:

- Search for camping facilities by location, state, or other criteria
- Get detailed information about specific facilities and campsites
- Check real-time campsite availability
- Get comprehensive campground availability calendars
- Access facility location and address information

## Installation

The required dependencies are already installed. The MCP SDK package `@modelcontextprotocol/sdk` is included in your `package.json`.

## Configuration

### Environment Variables

The MCP server uses the same environment variables as your REST API. Ensure your `.env` file contains:

```env
RIDB_BASE_URL=https://ridb.recreation.gov/api/v1
RIDB_API_KEY=your_ridb_api_key_here
AVAILABLE_CAMPSITE_STATUSES=Available,Open
RATE_LIMIT_PAUSE_SECONDS=120
```

### MCP Configuration File

The `mcp-config.json` file can be used to configure MCP clients (like Claude Desktop or other AI assistants) to connect to your server:

```json
{
  "mcpServers": {
    "ridb-camping": {
      "command": "node",
      "args": ["src/mcpServer.js"],
      "env": {
        "RIDB_BASE_URL": "https://ridb.recreation.gov/api/v1",
        "RIDB_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## Running the MCP Server

### Start the MCP Server

```bash
npm run mcp
```

### Development Mode (with auto-restart)

```bash
npm run mcp:dev
```

### Running Both REST and MCP Servers

You can run both servers simultaneously in separate terminal windows:

**Terminal 1 (REST API):**
```bash
npm start
```

**Terminal 2 (MCP Server):**
```bash
npm run mcp
```

## Using with AI Assistants

### Claude Desktop Configuration

To use this MCP server with Claude Desktop:

1. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the server configuration:

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

3. Restart Claude Desktop

### Other MCP Clients

The server uses stdio transport, making it compatible with any MCP client that supports stdio-based servers.

## Available Tools

The MCP server exposes the following tools for AI agents:

### 1. `search_facilities`

Search for camping facilities by location, state, or other criteria.

**Parameters:**
- `query` (string, optional): Search query for facility name
- `state` (string, optional): Two-letter state code (e.g., "CA", "NY")
- `latitude` (number, optional): Latitude for location-based search
- `longitude` (number, optional): Longitude for location-based search
- `radius` (number, optional): Search radius in miles (requires lat/long)
- `limit` (number, optional): Maximum number of results (default: 100)
- `offset` (number, optional): Offset for pagination (default: 0)

**Example:**
```json
{
  "query": "Yosemite",
  "state": "CA",
  "limit": 10
}
```

### 2. `get_facility`

Get detailed information about a specific camping facility.

**Parameters:**
- `facilityId` (string, required): The unique ID of the facility

**Example:**
```json
{
  "facilityId": "232447"
}
```

### 3. `get_facility_campsites`

Get all campsites available at a specific facility.

**Parameters:**
- `facilityId` (string, required): The unique ID of the facility

**Example:**
```json
{
  "facilityId": "232447"
}
```

### 4. `get_campsite_details`

Get detailed information about a specific campsite including amenities, capacity, and restrictions.

**Parameters:**
- `campsiteId` (string, required): The unique ID of the campsite

**Example:**
```json
{
  "campsiteId": "12345"
}
```

### 5. `check_campsite_availability`

Check if a campsite is available for specific dates.

**Parameters:**
- `campsiteId` (string, required): The unique ID of the campsite
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, optional): End date in YYYY-MM-DD format (defaults to start date)

**Example:**
```json
{
  "campsiteId": "12345",
  "startDate": "2025-06-15",
  "endDate": "2025-06-18"
}
```

### 6. `get_campground_availability`

Get availability for all campsites in a campground for a specific month.

**Parameters:**
- `campgroundId` (string, required): The unique ID of the campground/facility
- `startDate` (string, required): Start date for the month in ISO format

**Example:**
```json
{
  "campgroundId": "232447",
  "startDate": "2025-06-01T00:00:00.000Z"
}
```

### 7. `get_facility_address`

Get the physical address and location details for a facility.

**Parameters:**
- `facilityId` (string, required): The unique ID of the facility

**Example:**
```json
{
  "facilityId": "232447"
}
```

## Available Resources

Resources provide structured information about the camping system:

### 1. `ridb://facilities/search`

Information about searching camping facilities.

### 2. `ridb://campsites/availability`

Information about checking campsite availability.

## Available Prompts

Prompts help AI agents understand common user intents and generate appropriate queries:

### 1. `find_camping`

Help find camping facilities based on location or preferences.

**Arguments:**
- `location` (required): Location to search (city, state, or coordinates)
- `dates` (optional): Desired camping dates

### 2. `check_availability`

Check availability for a specific campsite or facility.

**Arguments:**
- `facilityName` (required): Name of the camping facility
- `startDate` (required): Check-in date (YYYY-MM-DD)
- `endDate` (optional): Check-out date (YYYY-MM-DD)

### 3. `plan_camping_trip`

Get comprehensive help planning a camping trip.

**Arguments:**
- `destination` (required): Desired camping destination or region
- `duration` (optional): Length of stay
- `preferences` (optional): Camping preferences (e.g., RV sites, tent camping, amenities)

## Example Usage Scenarios

### Scenario 1: Finding Camping Near Yosemite

An AI agent can use the following sequence:

1. Use `search_facilities` with query="Yosemite" and state="CA"
2. Get facility details using `get_facility` for interesting results
3. Use `get_facility_campsites` to see available campsites
4. Check availability using `check_campsite_availability` for desired dates

### Scenario 2: Planning a Weekend Trip

An AI agent can use the `plan_camping_trip` prompt:

```json
{
  "destination": "Lake Tahoe, CA",
  "duration": "2 nights",
  "preferences": "tent camping, near water"
}
```

This generates a structured query that guides the agent through finding suitable facilities and checking availability.

## Architecture

### Communication

The MCP server uses stdio (standard input/output) for communication, making it lightweight and easy to integrate with various AI clients.

### Data Flow

```
AI Agent → MCP Client → stdio → MCP Server → RIDB API / Recreation.gov
                                      ↓
                                 Response
                                      ↓
AI Agent ← MCP Client ← stdio ← MCP Server
```

### Error Handling

The server includes comprehensive error handling for:
- Rate limiting (429 errors) with automatic retry and backoff
- Invalid parameters with descriptive error messages
- API errors with detailed error information
- Network failures with appropriate error responses

## Rate Limiting

The Recreation.gov API has rate limits. The server automatically handles rate limit errors (HTTP 429) by:

1. Detecting the rate limit response
2. Pausing for a configurable duration (default: 120 seconds)
3. Automatically retrying the request

Configure the pause duration via the `RATE_LIMIT_PAUSE_SECONDS` environment variable.

## Security Considerations

1. **API Keys**: Keep your RIDB API key secure. Never commit it to version control.
2. **Environment Variables**: Use `.env` files for local development and proper secret management in production.
3. **Access Control**: The MCP server runs locally and is designed for trusted AI agents. For production use, consider additional authentication mechanisms.

## Troubleshooting

### Server Won't Start

**Issue**: "Error: RIDB_BASE_URL or RIDB_API_KEY not configured"

**Solution**: Ensure your `.env` file exists and contains valid configuration:
```bash
cp .env.example .env
# Edit .env with your actual API key
```

### Rate Limiting Errors

**Issue**: Frequent 429 errors from Recreation.gov

**Solution**: Increase `RATE_LIMIT_PAUSE_SECONDS` in your `.env` file:
```env
RATE_LIMIT_PAUSE_SECONDS=180
```

### AI Agent Can't Connect

**Issue**: Claude Desktop or other client can't find the server

**Solution**: 
1. Verify the absolute path in your MCP client configuration
2. Ensure Node.js is in your system PATH
3. Check that the server starts without errors: `npm run mcp`

## Development

### Adding New Tools

To add a new tool to the MCP server:

1. Add the tool definition to the `ListToolsRequestSchema` handler
2. Implement the tool logic in the `CallToolRequestSchema` handler
3. Update this documentation

### Testing

Test the MCP server using the MCP inspector or by integrating it with an AI client like Claude Desktop.

## REST API vs MCP Server

Both interfaces provide access to the same underlying functionality:

| Feature | REST API | MCP Server |
|---------|----------|------------|
| **Purpose** | Web applications, direct HTTP access | AI agents, conversational interfaces |
| **Transport** | HTTP/HTTPS | stdio |
| **Format** | JSON over HTTP | MCP protocol messages |
| **Discovery** | Manual (documentation) | Automatic (tools, resources, prompts) |
| **Use Case** | Frontend apps, mobile apps | AI assistants, chatbots |

Choose the interface that best fits your use case:
- Use **REST API** for traditional web/mobile applications
- Use **MCP Server** for AI agent integrations and conversational interfaces

## Support

For issues related to:
- **RIDB API**: Visit the [RIDB API documentation](https://ridb.recreation.gov/)
- **Recreation.gov API**: Check the Recreation.gov developer resources
- **MCP Protocol**: See the [Model Context Protocol specification](https://modelcontextprotocol.io/)

## License

This implementation follows the same license as the main RIDB backend project.
