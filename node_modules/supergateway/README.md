![Supergateway: Run stdio MCP servers over SSE](https://raw.githubusercontent.com/supercorp-ai/supergateway/main/supergateway.png)

**Supergateway** runs a **MCP stdio-based servers** over **SSE (Server-Sent Events)** with one command. This is useful for remote access, debugging, or connecting to SSE-based clients when your MCP server only speaks stdio.

Supported by [superinterface.ai](https://superinterface.ai) and [supercorp.ai](https://supercorp.ai).

## Installation & Usage

Run Supergateway via `npx`:

```bash
npx -y supergateway --stdio "uvx mcp-server-git"
```

- **`--port 8000`**: Port to listen on (default: `8000`)
- **`--stdio "command"`**: Command that runs an MCP server over stdio
- **`--baseUrl "http://localhost:8000"`**: Base URL for SSE clients (stdio to SSE mode; optional)
- **`--ssePath "/sse"`**: Path for SSE subscriptions (stdio to SSE mode; default: `/sse`)
- **`--messagePath "/message"`**: Path for SSE messages (stdio to SSE mode; default: `/message`)
- **`--sse "https://mcp-server.superinterface.app"`**: SSE URL to connect to

Once started on SSE:
- **SSE endpoint**: `GET http://localhost:8000/sse`
- **POST messages**: `POST http://localhost:8000/message`

## SSE to Stdio Mode

Supergateway also supports running in **SSE to Stdio** mode. Instead of providing a `--stdio` command, specify the `--sse` flag with an SSE URL. In this mode, Supergateway connects to the remote SSE server and exposes a local stdio interface for downstream clients.

Example:

```bash
npx -y supergateway --sse "https://mcp-server-example.superinterface.app"
```

## Example with MCP Inspector

1. **Run Supergateway**:
   ```bash
   npx -y supergateway --port 8000 \
       --stdio "npx -y @modelcontextprotocol/server-filesystem /Users/MyName/Desktop"
   ```
2. **Use MCP Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector --uri http://localhost:8000/sse
   ```
   You can then read resources, list tools, or run other MCP actions through Supergateway.

## Using with ngrok

You can use [ngrok](https://ngrok.com/) to share your local MCP server with remote clients:

```bash
npx -y supergateway --port 8000 \
    --stdio "npx -y @modelcontextprotocol/server-filesystem ."
# In another terminal:
ngrok http 8000
```

ngrok then provides a public URL.

## Why MCP?

[Model Context Protocol](https://spec.modelcontextprotocol.io/) standardizes how AI tools exchange data. If your MCP server only speaks stdio, Supergateway exposes an SSE-based interface so remote clients (and tools like MCP Inspector) can connect without extra server changes.

## Advanced Configuration

Supergateway is designed with modularity in mind:
- It automatically derives the JSON‑RPC version from incoming requests, ensuring future compatibility.
- Package information (name and version) is retransmitted where possible.
- Stdio-to-SSE mode uses standard logs and SSE-to-Stdio mode logs via stderr (as otherwise it would prevent stdio functionality).

## Contributing

Issues and PRs are welcome. Please open one if you have ideas or encounter any problems.

## License

[MIT License](./LICENSE)
