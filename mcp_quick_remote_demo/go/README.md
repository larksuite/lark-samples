# Go Remote MCP Demo
# Go 远程 MCP Demo

This project demonstrates a minimal runnable version of **Go + Remote / HTTP MCP**:
本项目演示 **Go + Remote / HTTP MCP** 的最小可运行版本：

- Exchange `tenant_access_token` (TAT) using `APP_ID/APP_SECRET`
  用 `APP_ID/APP_SECRET` 换取 `tenant_access_token`（TAT）
- Connect to Remote MCP Endpoint (default `https://mcp.feishu.cn/mcp`) via `client.NewStreamableHttpClient`
  通过 `client.NewStreamableHttpClient` 连接 Remote MCP Endpoint（默认 `https://mcp.feishu.cn/mcp`）
- Control tool whitelist via Header (default: `get-comments,fetch-doc`)
  通过 Header 控制工具白名单（默认：`get-comments,fetch-doc`）
- Inject MCP tools into Eino ReAct Agent to trigger tool calls during chat
  将 MCP tools 注入 Eino ReAct Agent，在对话中触发工具调用

## Prerequisites | 前置要求

- Go 1.24.1+
- OpenAI Compatible Model Key (`OPENAI_API_KEY` / `OPENAI_MODEL`)
  OpenAI 兼容模型的 Key（`OPENAI_API_KEY` / `OPENAI_MODEL`）
- Feishu/Lark App Credentials (`APP_ID` / `APP_SECRET`)
  飞书/Lark 应用凭证（`APP_ID` / `APP_SECRET`）

## Configuration | 配置

Copy and fill in `.env` in `mcp_quick_remote_demo/go` directory:
在 `mcp_quick_remote_demo/go` 目录复制并填写 `.env`：

```bash
cp .env.example .env
```

## Usage | 运行

```bash
cd mcp_quick_remote_demo/go
go mod tidy
go run .
```

## Common Customizations | 常见定制

- **Modify Prompts**: Edit `UserPrompt` / `SystemPrompt` in `mcp_quick_remote_demo/go/main.go`
  **修改提示词**：编辑 `mcp_quick_remote_demo/go/main.go` 中 `UserPrompt` / `SystemPrompt`
- **Modify Tool Whitelist**: Set `LARK_MCP_ALLOWED_TOOLS` or adjust `X-Lark-MCP-Allowed-Tools` in `main.go`
  **修改工具白名单**：设置 `LARK_MCP_ALLOWED_TOOLS` 或调整 `main.go` 里的 `X-Lark-MCP-Allowed-Tools`
- **Modify MCP Endpoint**: Set `MCP_URL` (configuration recommended for production)
  **修改 MCP Endpoint**：设置 `MCP_URL`（生产建议配置化）

## References | 参考

- MCP Go Client: https://mcp-go.dev/clients
- Lark OpenAPI MCP: https://github.com/larksuite/lark-openapi-mcp
