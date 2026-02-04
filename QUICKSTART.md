# Quick Start Guide

This guide will get you up and running with both the REST API and MCP server in 5 minutes.

## Prerequisites Check

```bash
node --version  # Should be v14 or higher
npm --version   # Should be v6 or higher
```

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your RIDB API key
# Get your free API key at: https://ridb.recreation.gov/
```

Required `.env` settings:
```env
RIDB_BASE_URL=https://ridb.recreation.gov/api/v1
RIDB_API_KEY=YOUR_API_KEY_HERE
PORT=3000
```

### 3. Initialize Database

```bash
node db/initialize.js
```

## Running the Servers

### Option 1: REST API Only

```bash
npm start
```

Test it:
```bash
curl http://localhost:3000/api/facilities?query=Yosemite&state=CA&limit=5
```

### Option 2: MCP Server Only (for AI Agents)

```bash
npm run mcp
```

Test it:
```bash
npm run test:mcp
```

### Option 3: Both Servers

**Terminal 1 - REST API:**
```bash
npm start
```

**Terminal 2 - MCP Server:**
```bash
npm run mcp
```

## Quick Test Examples

### REST API Tests

#### 1. Search for facilities
```bash
curl "http://localhost:3000/api/facilities?query=Yosemite&state=CA&limit=3"
```

#### 2. Get facility details (example ID)
```bash
curl "http://localhost:3000/api/facilities/232447"
```

#### 3. Get campsites for a facility
```bash
curl "http://localhost:3000/api/facilities/232447/campsites"
```

#### 4. Check campsite availability
```bash
curl "http://localhost:3000/api/campsites/availability/12345"
```

### MCP Server Test

```bash
npm run test:mcp
```

Expected output:
```
Starting MCP Server test suite...

Test 1: Initialize server...
✓ Server initialized successfully
  Server name: ridb-camping-server
  Server version: 1.0.0

Test 2: List available tools...
✓ Found 7 tools:
  - search_facilities: Search for camping facilities...
  - get_facility: Get detailed information...
  ...

==================================================
Test Summary:
  Passed: 7
  Failed: 0
  Total: 7
==================================================
```

## Using with Claude Desktop

### 1. Locate Configuration File

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/
```

**Windows:**
```powershell
explorer %APPDATA%\Claude\
```

### 2. Edit `claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "ridb-camping": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/ridb-backend/src/mcpServer.js"],
      "env": {
        "RIDB_BASE_URL": "https://ridb.recreation.gov/api/v1",
        "RIDB_API_KEY": "YOUR_ACTUAL_API_KEY"
      }
    }
  }
}
```

**Important:** Replace `/ABSOLUTE/PATH/TO/` with your actual path!

Find your path:
```bash
pwd
# Output example: /Users/yourname/projects/ridb-backend
```

### 3. Restart Claude Desktop

Close and reopen Claude Desktop completely.

### 4. Test in Claude

Try asking Claude:
- "Search for camping facilities near Yosemite"
- "Find available campsites at Half Dome Village for June 15-18"
- "Help me plan a camping trip to Lake Tahoe"

## Common Issues

### Issue: "RIDB_API_KEY not configured"

**Solution:**
1. Make sure `.env` file exists
2. Check that `RIDB_API_KEY=` has a value (no spaces around `=`)
3. Get your API key from https://ridb.recreation.gov/

### Issue: "Port 3000 already in use"

**Solution:**
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill the process (macOS/Linux)
kill -9 $(lsof -ti:3000)

# Or change the port in .env
PORT=3001
```

### Issue: MCP server not appearing in Claude

**Solution:**
1. Verify the absolute path in `claude_desktop_config.json`
2. Check that `node` is in your PATH: `which node`
3. Test the MCP server directly: `npm run test:mcp`
4. Restart Claude Desktop completely (not just the window)
5. Check Claude's logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### Issue: Rate limit errors (429)

**Solution:**
Add to your `.env`:
```env
RATE_LIMIT_PAUSE_SECONDS=180
```

## Next Steps

### For REST API Development

1. Read the [full API documentation](README.md#rest-api-endpoints)
2. Test endpoints with Postman or similar tools
3. Integrate with your frontend application

### For MCP/AI Agent Development

1. Read the [detailed MCP documentation](MCP_README.md)
2. Configure your AI client (Claude, etc.)
3. Explore available tools and prompts

### For Contributing

1. Check the [project structure](README.md#project-structure)
2. Review the [architecture](README.md#architecture)
3. Add features following the patterns in existing code

## Development Workflow

### Making Changes

```bash
# 1. Start development server (auto-reloads on changes)
npm run dev

# 2. In another terminal, test your changes
curl http://localhost:3000/api/your-endpoint

# 3. For MCP development
npm run mcp:dev
```

### Running Tests

```bash
# Test MCP server
npm run test:mcp

# Test REST API (manually via curl or Postman)
curl http://localhost:3000/api/facilities
```

## Example Workflows

### Workflow 1: Find and Monitor a Campsite

1. **Search for facilities:**
```bash
curl "http://localhost:3000/api/facilities?query=Yosemite&state=CA"
```

2. **Get campsites for a facility:**
```bash
curl "http://localhost:3000/api/facilities/232447/campsites"
```

3. **Check availability:**
```bash
curl "http://localhost:3000/api/campsites/availability/12345"
```

4. **Create reservation monitor:**
```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### Workflow 2: Using MCP with Claude

1. Configure Claude Desktop (see above)
2. Ask Claude: "Search for camping near Lake Tahoe"
3. Claude will automatically use the `search_facilities` tool
4. Ask: "Check availability for site 42 on June 15-18"
5. Claude will use `check_campsite_availability`

## Help and Resources

- **Full Documentation**: [README.md](README.md)
- **MCP Documentation**: [MCP_README.md](MCP_README.md)
- **RIDB API Docs**: https://ridb.recreation.gov/
- **MCP Protocol**: https://modelcontextprotocol.io/

## Getting API Keys

### RIDB API Key (Required)

1. Visit https://ridb.recreation.gov/
2. Click "Register" or "Get API Key"
3. Fill out the registration form
4. Receive your API key via email
5. Add to `.env` file

**Note**: RIDB API keys are free and usually issued instantly.

## Performance Tips

1. **Use pagination** for large result sets:
   ```
   /api/facilities?limit=50&offset=0
   ```

2. **Cache responses** when appropriate (facility data changes infrequently)

3. **Respect rate limits** - the system handles this automatically, but avoid unnecessary requests

4. **Use specific queries** instead of broad searches when possible

## Security Notes

- Never commit `.env` file to version control
- Keep your API keys secure
- Use app-specific passwords for email (not your main password)
- Configure CORS appropriately in production

## Success!

If you've made it this far, you should have:
- ✅ Both servers running
- ✅ Tested endpoints successfully
- ✅ (Optional) Claude Desktop integration working

Happy camping! 🏕️
