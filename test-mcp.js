/**
 * Test script for the RIDB Camping MCP Server
 * 
 * This script demonstrates how to interact with the MCP server programmatically.
 * It sends test requests to verify all tools are working correctly.
 */

const { spawn } = require("child_process");
const readline = require("readline");

/**
 * Sends a JSON-RPC request to the MCP server via stdio
 * @param {object} server - The spawned server process
 * @param {object} request - The JSON-RPC request object
 * @returns {Promise<object>} The response from the server
 */
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    const requestStr = JSON.stringify(request) + "\n";
    
    // Set up one-time response listener
    const onData = (data) => {
      try {
        const lines = data.toString().split("\n").filter(line => line.trim());
        for (const line of lines) {
          // Skip log messages (they go to stderr)
          if (line.startsWith("{")) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              server.stdout.removeListener("data", onData);
              resolve(response);
              return;
            }
          }
        }
      } catch (error) {
        // Ignore parse errors for log messages
      }
    };

    server.stdout.on("data", onData);
    
    // Set timeout
    setTimeout(() => {
      server.stdout.removeListener("data", onData);
      reject(new Error("Request timeout"));
    }, 10000);

    // Send the request
    server.stdin.write(requestStr);
  });
}

/**
 * Main test function
 */
async function runTests() {
  console.log("Starting MCP Server test suite...\n");

  // Spawn the MCP server
  const server = spawn("node", ["src/mcpServer.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Log stderr output
  server.stderr.on("data", (data) => {
    console.log("Server log:", data.toString().trim());
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Initialize the server
    console.log("Test 1: Initialize server...");
    const initResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: {
            listChanged: true
          }
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }
    });
    
    if (initResponse.result) {
      console.log("✓ Server initialized successfully");
      console.log("  Server name:", initResponse.result.serverInfo.name);
      console.log("  Server version:", initResponse.result.serverInfo.version);
      testsPassed++;
    } else {
      console.log("✗ Server initialization failed");
      testsFailed++;
    }

    // Test 2: List available tools
    console.log("\nTest 2: List available tools...");
    const toolsResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    });

    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log(`✓ Found ${toolsResponse.result.tools.length} tools:`);
      toolsResponse.result.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      testsPassed++;
    } else {
      console.log("✗ Failed to list tools");
      testsFailed++;
    }

    // Test 3: List available resources
    console.log("\nTest 3: List available resources...");
    const resourcesResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 3,
      method: "resources/list",
      params: {}
    });

    if (resourcesResponse.result && resourcesResponse.result.resources) {
      console.log(`✓ Found ${resourcesResponse.result.resources.length} resources:`);
      resourcesResponse.result.resources.forEach(resource => {
        console.log(`  - ${resource.uri}: ${resource.name}`);
      });
      testsPassed++;
    } else {
      console.log("✗ Failed to list resources");
      testsFailed++;
    }

    // Test 4: List available prompts
    console.log("\nTest 4: List available prompts...");
    const promptsResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 4,
      method: "prompts/list",
      params: {}
    });

    if (promptsResponse.result && promptsResponse.result.prompts) {
      console.log(`✓ Found ${promptsResponse.result.prompts.length} prompts:`);
      promptsResponse.result.prompts.forEach(prompt => {
        console.log(`  - ${prompt.name}: ${prompt.description}`);
      });
      testsPassed++;
    } else {
      console.log("✗ Failed to list prompts");
      testsFailed++;
    }

    // Test 5: Call a tool (search_facilities)
    console.log("\nTest 5: Call search_facilities tool...");
    try {
      const searchResponse = await sendRequest(server, {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "search_facilities",
          arguments: {
            query: "Yosemite",
            state: "CA",
            limit: 5
          }
        }
      });

      if (searchResponse.result && searchResponse.result.content) {
        console.log("✓ search_facilities tool executed successfully");
        const content = searchResponse.result.content[0];
        if (content.type === "text") {
          const data = JSON.parse(content.text);
          console.log(`  Found ${data.RECDATA?.length || 0} facilities`);
        }
        testsPassed++;
      } else {
        console.log("✗ search_facilities tool failed");
        testsFailed++;
      }
    } catch (error) {
      console.log("✗ search_facilities tool error:", error.message);
      testsFailed++;
    }

    // Test 6: Read a resource
    console.log("\nTest 6: Read a resource...");
    const readResourceResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 6,
      method: "resources/read",
      params: {
        uri: "ridb://facilities/search"
      }
    });

    if (readResourceResponse.result && readResourceResponse.result.contents) {
      console.log("✓ Resource read successfully");
      testsPassed++;
    } else {
      console.log("✗ Failed to read resource");
      testsFailed++;
    }

    // Test 7: Get a prompt
    console.log("\nTest 7: Get a prompt...");
    const getPromptResponse = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 7,
      method: "prompts/get",
      params: {
        name: "find_camping",
        arguments: {
          location: "Lake Tahoe, CA",
          dates: "June 15-18, 2025"
        }
      }
    });

    if (getPromptResponse.result && getPromptResponse.result.messages) {
      console.log("✓ Prompt retrieved successfully");
      console.log("  Generated prompt:", getPromptResponse.result.messages[0].content.text.substring(0, 100) + "...");
      testsPassed++;
    } else {
      console.log("✗ Failed to get prompt");
      testsFailed++;
    }

  } catch (error) {
    console.error("\nTest error:", error.message);
    testsFailed++;
  } finally {
    // Clean up
    server.kill();
    
    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("Test Summary:");
    console.log(`  Passed: ${testsPassed}`);
    console.log(`  Failed: ${testsFailed}`);
    console.log(`  Total: ${testsPassed + testsFailed}`);
    console.log("=".repeat(50));

    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
