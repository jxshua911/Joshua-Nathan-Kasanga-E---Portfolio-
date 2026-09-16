import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { connect, type Framer } from "framer-api";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3000);
const PROJECT_URL = process.env.FRAMER_PROJECT_URL;
const API_KEY = process.env.FRAMER_API_KEY;

function assertConfig() {
  if (!PROJECT_URL) throw new Error("FRAMER_PROJECT_URL is not configured");
  if (!API_KEY) throw new Error("FRAMER_API_KEY is not configured");
}

async function withFramer<T>(fn: (framer: Framer) => Promise<T>): Promise<T> {
  assertConfig();
  const framer = await connect(PROJECT_URL!, API_KEY!);
  try {
    return await fn(framer);
  } finally {
    await framer.disconnect();
  }
}

function makeServer() {
  const server = new McpServer({
    name: "joshua-framer-portfolio",
    version: "0.1.0",
  });

  server.registerTool(
    "framer_project_info",
    {
      title: "Inspect Framer project",
      description: "Read basic metadata and publishing information for Joshua Kasanga's Framer portfolio. Read-only.",
      inputSchema: {},
    },
    async () => {
      const result = await withFramer(async (framer) => {
        const [project, publish] = await Promise.all([
          framer.getProjectInfo(),
          framer.getPublishInfo(),
        ]);
        return { project, publish };
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "framer_changed_paths",
    {
      title: "Inspect unpublished changes",
      description: "Show Framer paths changed since the last published version. Read-only.",
      inputSchema: {},
    },
    async () => {
      const result = await withFramer((framer) => framer.getChangedPaths());
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "framer_publish_preview",
    {
      title: "Publish Framer preview",
      description: "Publish current Framer changes as a preview deployment. Does not promote to production.",
      inputSchema: {
        confirm: z.literal(true).describe("Must be true to explicitly confirm publishing a preview."),
      },
    },
    async ({ confirm }) => {
      if (confirm !== true) throw new Error("Explicit confirmation is required.");
      const result = await withFramer((framer) => framer.publish());
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "joshua-framer-portfolio" }));
    return;
  }

  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = makeServer();
  await server.connect(transport);

  try {
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    if (!res.writableEnded) res.end(JSON.stringify({ error: "MCP request failed" }));
  } finally {
    await server.close();
  }
});

httpServer.listen(PORT, () => {
  console.log(`Joshua Framer MCP server listening on :${PORT}`);
});
