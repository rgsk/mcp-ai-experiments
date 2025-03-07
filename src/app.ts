import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import express from "express";
import environmentVars from "lib/environmentVars";
import jsonDataService from "lib/jsonDataService";
import { Memory } from "lib/typesJsonData";
import saveUserInfoToMemory from "tools/saveUserInfoToMemory";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "Node AI Experiments MCP Server",
  version: "1.0.0",
});

server.resource(
  "userMemories",
  new ResourceTemplate("users://{userEmail}/memories", { list: undefined }),
  async (uri, { userEmail }) => {
    const key = `reactAIExperiments/users/${userEmail}/memories`;

    const jsonData = await jsonDataService.getKey<Memory[]>({ key });
    const memories = jsonData?.value;
    const statements = memories?.map((m) => m.statement);
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(statements),
        },
      ],
    };
  }
);

server.tool(
  "saveUserInfoToMemory",
  "Save any information the user reveals about themselves during conversations — this includes their preferences, interests, goals, plans, likes/dislikes, personality traits, or anything relevant that can help personalize future conversations.",
  {
    statement: z.string({
      description:
        "A concise statement that captures the information to be saved (e.g., 'User plans to start an AI & robotics company', 'User likes sci-fi movies', 'User works at Google').",
    }),
    userEmail: z.string().email(),
  },
  async ({ statement, userEmail }) => {
    console.log({ statement, userEmail });
    const result = await saveUserInfoToMemory({ statement, userEmail });
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }
);

const app = express();
app.use(cors());
let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  // Note: to support multiple simultaneous connections, these messages will
  // need to be routed to a specific matching transport. (This logic isn't
  // implemented here, for simplicity.)
  await transport.handlePostMessage(req, res);
});
const PORT = environmentVars.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
