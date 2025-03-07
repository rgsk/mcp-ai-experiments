import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import aiService from "lib/aiService";
import environmentVars from "lib/environmentVars";
import fileLogger from "lib/fileLogger";
import jsonDataService from "lib/jsonDataService";
import { Memory, Persona } from "lib/typesJsonData";
import { v4 } from "uuid";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "Node AI Experiments MCP Server",
  version: "1.0.0",
});

server.resource(
  "userMemories",
  new ResourceTemplate("users://{userEmail}/memories", { list: undefined }),
  async (uri, variables) => {
    fileLogger.log({
      resource: "userMemories",
      variables,
    });

    const { userEmail } = variables;
    const key = `reactAIExperiments/users/${userEmail}/memories`;

    const jsonData = await jsonDataService.getKey<Memory[]>({ key });
    const memories = jsonData?.value;
    const statements = memories?.map((m) => m.statement);
    fileLogger.log({
      resource: "userMemories",
      output: statements,
    });
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
  "getRelevantDocs",
  "When you are acting as persona, this tool helps you to get the relevant docs to respond, for this persona data from various sources is collected like websites, pdfs, image texts. When you run this function, you get the relevant texts, which you can use as context to answer user query. This function performs RAG on texts of all those data sources.",
  {
    query: z.string({
      description: "A query based on which docs will be fetched.",
    }),
    personaId: z.string(),
    userEmail: z.string().email(),
    sources: z
      .string({ description: "filter by particular sources" })
      .array()
      .optional(),
    numDocs: z
      .number({ description: "num of documents to be fetched" })
      .optional(),
  },
  async (body) => {
    fileLogger.log({
      tool: "getRelevantDocs",
      body,
    });
    const { query, personaId, userEmail, numDocs, sources } = body;
    const result = await jsonDataService.getKey<Persona>({
      key: `reactAIExperiments/users/${userEmail}/personas/${personaId}`,
    });
    const persona = result?.value;
    if (!persona) {
      throw new Error("persona not found");
    }
    //   console.log({ query });
    const relevantDocs = await aiService.getRelevantDocs({
      query: query,
      collectionName: persona.collectionName,
      numDocs,
      sources,
    });
    fileLogger.log({
      tool: "getRelevantDocs",
      output: relevantDocs,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(relevantDocs),
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
  async (body) => {
    fileLogger.log({
      tool: "saveUserInfoToMemory",
      body,
    });
    const { statement, userEmail } = body;
    const key = `reactAIExperiments/users/${userEmail}/memories`;
    const jsonData = await jsonDataService.getKey<Memory[]>({ key });
    const memory: Memory = {
      id: v4(),
      statement,
      createdAt: new Date().toISOString(),
    };
    if (!jsonData) {
      const jsonData = await jsonDataService.setKey({
        key: key,
        value: [memory],
      });
    } else {
      const memories = jsonData.value;
      const newJsonData = await jsonDataService.setKey({
        key: key,
        value: [...memories, memory],
      });
    }
    const text = "Saved Successfully";
    fileLogger.log({
      tool: "saveUserInfoToMemory",
      output: text,
    });
    return {
      content: [
        {
          type: "text",
          text: text,
        },
      ],
    };
  }
);

const app = express();
// app.use(cors());
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
