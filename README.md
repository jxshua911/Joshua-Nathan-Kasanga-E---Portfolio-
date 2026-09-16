# Joshua Framer MCP Connector

Secure MCP server for controlling Joshua Kasanga's Framer portfolio through the Framer Server API.

## Runtime configuration

Set these environment variables in the hosting platform. Never commit their values.

- `FRAMER_API_KEY` — Framer Server API key for the portfolio project.
- `FRAMER_PROJECT_URL` — `https://joshuakasanga.framer.website`.
- `MCP_AUTH_TOKEN` — a separate random bearer token used to authenticate MCP requests.
- `PORT` — optional HTTP port; defaults to `3000`.

## Endpoints

- `GET /health` — public health/configuration status without revealing secrets.
- `POST /mcp` — authenticated Streamable HTTP MCP endpoint.

The MCP endpoint requires:

`Authorization: Bearer <MCP_AUTH_TOKEN>`

## Current MCP tools

- `framer_project_info` — inspect project metadata and publish information.
- `framer_changed_paths` — inspect unpublished changes.
- `framer_find_text` — find text layers by text/name.
- `framer_set_text` — update one exact TextNode after explicit confirmation.
- `framer_publish_preview` — publish a preview after explicit confirmation.

Production deployment is intentionally not exposed as an automatic tool yet. Preview changes should be reviewed before promotion.

## Security

The Framer API key and MCP bearer token are runtime secrets only. Do not place either value in Git, source code, logs, prompts, or client-side code.
