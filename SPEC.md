# Framer ChatGPT Connector

## Goal
Create a secure MCP server that lets ChatGPT inspect and eventually modify Joshua Kasanga's Framer portfolio through the Framer Server API, without exposing the Framer API key to GitHub or the client.

## Target
- Framer portfolio: `joshuakasanga.framer.website`
- GitHub repository: `jxshua911/Joshua-Nathan-Kasanga-E---Portfolio-`

## Architecture
ChatGPT → MCP server → Framer Server API → Framer project

The Framer API key must exist only as a deployment/runtime secret (`FRAMER_API_KEY`). It must never be committed to source control, logged, returned by a tool, or embedded in client-side code.

## Initial tools
1. `framer_project_info` — read-only project connectivity/metadata check.
2. `framer_pages` — read-only page discovery.

## Planned tools
- Read page structure/content.
- Update approved text/content fields.
- Update supported styling and assets.
- Publish changes.

## Safety requirements
- Read-only tools first.
- Never expose secrets.
- Validate all write inputs server-side.
- Keep destructive/publishing operations separate and explicit.
- Do not invent Framer API endpoints; implement against documented Server API capabilities.

## Deployment
The MCP server will be deployable as a hosted HTTPS MCP endpoint that can be connected to ChatGPT. Runtime secrets will be configured in the deployment environment.

## Current status
- Repository is empty and ready for the connector foundation.
- Framer API key has been created by the user but must not be pasted into chat or committed to GitHub.
