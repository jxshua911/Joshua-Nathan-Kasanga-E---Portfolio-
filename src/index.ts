import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { connect } from "framer-api";
import { z } from "zod";
import { isAuthorised } from "./auth.js";

const PORT = Number(process.env.PORT ?? 3000);
const PROJECT_URL = process.env.FRAMER_PROJECT_URL;
const API_KEY = process.env.FRAMER_API_KEY;
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

type FramerClient = Awaited<ReturnType<typeof connect>>;

function assertConfig() {
  if (!PROJECT_URL) throw new Error("FRAMER_PROJECT_URL is not configured");
  if (!API_KEY) throw new Error("FRAMER_API_KEY is not configured");
}

async function withFramer<T>(fn: (framer: FramerClient) => Promise<T>): Promise<T> {
  assertConfig();
  const framer = await connect(PROJECT_URL!, API_KEY!);
  try { return await fn(framer); } finally { await framer.disconnect(); }
}

function makeServer() {
  const server = new McpServer({ name: "joshua-framer-portfolio", version: "0.2.0" });

  server.registerTool("framer_project_info", {
    title: "Inspect Framer project",
    description: "Read basic metadata and publishing information. Read-only.",
    inputSchema: {},
  }, async () => {
    const result = await withFramer(async (framer) => {
      const [project, publish] = await Promise.all([framer.getProjectInfo(), framer.getPublishInfo()]);
      return { project, publish };
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.registerTool("framer_changed_paths", {
    title: "Inspect unpublished changes",
    description: "Show Framer paths changed since the last published version. Read-only.",
    inputSchema: {},
  }, async () => {
    const result = await withFramer((framer) => framer.getChangedPaths());
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.registerTool("framer_publish_preview", {
    title: "Publish Framer preview",
    description: "Publish current changes as a preview deployment. Does not promote to production.",
    inputSchema: { confirm: z.literal("PUBLISH_PREVIEW") },
  }, async ({ confirm }) => {
    if (confirm !== "PUBLISH_PREVIEW") throw new Error("Explicit confirmation is required.");
    const result = await withFramer((framer) => framer.publish());
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.registerTool("framer_find_text", {
    title: "Find portfolio text",
    description: "Find TextNode layers by text or layer name. Read-only.",
    inputSchema: { query: z.string().min(1) },
  }, async ({ query }) => {
    const result = await withFramer(async (framer) => {
      const nodes = await framer.getNodesWithType("TextNode");
      const needle = query.toLowerCase();
      return nodes.filter((node: any) => `${node.name ?? ""} ${node.getText?.() ?? ""}`.toLowerCase().includes(needle))
        .map((node: any) => ({ id: node.id, name: node.name, text: node.getText?.() ?? "" }));
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.registerTool("framer_set_text", {
    title: "Update portfolio text",
    description: "Update one specific Framer TextNode. Does not publish.",
    inputSchema: {
      nodeId: z.string().min(1),
      text: z.string(),
      confirm: z.literal("UPDATE_TEXT"),
    },
  }, async ({ nodeId, text, confirm }) => {
    if (confirm !== "UPDATE_TEXT") throw new Error("Explicit confirmation is required.");
    const result = await withFramer(async (framer) => {
      const node: any = await framer.getNode(nodeId);
      if (!node || typeof node.setText !== "function") throw new Error(`TextNode not found: ${nodeId}`);
      await node.setText(text);
      return { id: nodeId, text };
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  return server;
}

const httpServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://chatgpt.com");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, mcp-session-id, mcp-protocol-version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "joshua-framer-portfolio", configured: Boolean(PROJECT_URL && API_KEY && MCP_AUTH_TOKEN) }));
    return;
  }

  if (req.url !== "/mcp") { res.writeHead(404); res.end("Not found"); return; }

  if (!isAuthorised(req, MCP_AUTH_TOKEN)) {
    res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
    res.end(JSON.stringify({ error: "Unauthorised" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const body = rawBody ? JSON.parse(rawBody) : undefined;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const server = makeServer();
    await server.connect(transport);
    try { await transport.handleRequest(req, res, body); } finally { await server.close(); }
  } catch (error) {
    console.error("MCP request failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    if (!res.writableEnded) res.end(JSON.stringify({ error: "MCP request failed" }));
  }
});

httpServer.listen(PORT, () => console.log(`Joshua Framer MCP server listening on :${PORT}`));
