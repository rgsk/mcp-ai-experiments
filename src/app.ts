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
import nodeService from "lib/nodeService";
import { Memory, Persona } from "lib/typesJsonData";
import { html } from "lib/utils";
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
  async (uri, args) => {
    fileLogger.log({
      resource: "userMemories",
      args,
    });
    const { userEmail } = args;
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
  async (args) => {
    fileLogger.log({
      tool: "getRelevantDocs",
      args,
    });
    const { query, personaId, userEmail, numDocs, sources } = args;
    const result = await jsonDataService.getKey<Persona>({
      key: `reactAIExperiments/users/${userEmail}/personas/${personaId}`,
    });
    const persona = result?.value;
    if (!persona) {
      throw new Error("persona not found");
    }
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
  async (args) => {
    fileLogger.log({
      tool: "saveUserInfoToMemory",
      args,
    });
    const { statement, userEmail } = args;
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

server.tool(
  "getUrlContent",
  "Get the contents of the web-page that the url is pointing to.",
  {
    url: z.string({
      description: "the url for the which the contents needs to be fetched",
    }),
    type: z
      .enum(
        [
          "pdf",
          "google_doc",
          "google_sheet",
          "web_page",
          "youtube_video",
          "image",
        ],
        {
          description: html`if you for sure know that url has contents for one
          of these categories (depending on extension or url structure), (or
          user has mentioned that summarise this pdf, then you for sure know
          type is to be sent as pdf, irrespective of url structure), then pass
          it, otherwise leave it empty`,
        }
      )
      .optional(),
  },
  async (args) => {
    fileLogger.log({
      tool: "getUrlContent",
      args,
    });
    const { url, type } = args;
    const text = await nodeService.getUrlContent({ url, type });
    fileLogger.log({
      tool: "getUrlContent",
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

server.tool(
  "executeCode",
  "you have to ability to execute code and give outputs of stdout to the user.",
  {
    code: z.string({
      description: html`the code to execute.
        <important>
          make sure you perform print/console.log, so you can the see the code
          execution output, if you won't do that you would get empty string as
          output.
        </important>`,
    }),
    language: z.enum(
      ["node", "javascript", "python", "typescript", "cpp", "unknown"],
      {
        description: html`programming language to use. If the user explicitly
        tells about which language to use, use that language. if it's not one of
        known language pass the value "unknown", I will throw an error.`,
      }
    ),
  },
  async (args) => {
    fileLogger.log({
      tool: "executeCode",
      args,
    });
    const { code, language } = args;
    if (language === "unknown") {
      throw new Error("This programming language is not supported");
    }
    const { output } = await nodeService.executeCode({ code, language });
    fileLogger.log({
      tool: "executeCode",
      output: output,
    });
    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }
);

server.prompt(
  "persona",
  { personaId: z.string(), userEmail: z.string() },
  async (args) => {
    fileLogger.log({
      prompt: "persona",
      args,
    });
    const { personaId, userEmail } = args;
    const result = await jsonDataService.getKey<Persona>({
      key: `reactAIExperiments/users/${userEmail}/personas/${personaId}`,
    });
    const persona = result?.value;
    if (!persona) {
      throw new Error("persona not found");
    }
    const personaInstruction = `
      user is interacting persona with following personality
      <persona>${JSON.stringify(persona)}</persona>
      you have to respond on persona's behalf

      additionally since, user interacting with this persona, getRelevantDocs tool becomes important
      so make sure to pass user query to that tool and fetch the relevant docs and respond accordingly
    `;
    fileLogger.log({
      prompt: "persona",
      output: personaInstruction,
    });
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: personaInstruction,
          },
        },
      ],
    };
  }
);

server.prompt("memory", { userEmail: z.string() }, async (args) => {
  fileLogger.log({
    prompt: "memory",
    args,
  });
  const { userEmail } = args;
  const key = `reactAIExperiments/users/${userEmail}/memories`;

  const jsonData = await jsonDataService.getKey<Memory[]>({ key });
  const memories = jsonData?.value;
  const statements = memories?.map((m) => m.statement);
  const memoryInstruction = html`
    Following memory statements are gathered from previous conversations with
    the user, try to incorporate them into the conversation context to provide a
    more personalized response.
    <statements> ${statements} </statements>

    additionally, if user has revealed something new about himself in the
    conversation so far, save that statement in the memory
  `;
  fileLogger.log({
    prompt: "memory",
    output: memoryInstruction,
  });
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: memoryInstruction,
        },
      },
    ],
  };
});

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
