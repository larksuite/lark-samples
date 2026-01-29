# MCP Quick Remote Demo

# MCP 远程接入快速演示

本目录 `mcp_quick_remote_demo/` 提供一个“可直接跑通”的 **Remote / HTTP MCP 接入 Demo**：客户端应用通过 `tenant_access_token`（TAT）鉴权，连接到 **Lark/飞书 OpenAPI MCP 远程 Endpoint**，在 AI Agent 推理过程中触发工具调用（示例默认：`fetch-doc` / `create-doc`）。

## ✅ 入口文档

- PRD：`mcp_quick_remote_demo/PRD.zh.md`
- 开发教程：`mcp_quick_remote_demo/DEVELOPMENT_GUIDE.zh.md`

## 📁 Project Structure | 项目结构

```
mcp_quick_remote_demo/
├── go/                     # Go (Eino + mcp-go)
├── java/                   # Java (LangChain4j)
├── nodejs/                 # Node.js (AI SDK / LangChain)
├── PRD.zh.md
├── DEVELOPMENT_GUIDE.zh.md
└── README.md
```

## 🚀 Quick Start | 快速开始

1. 选择语言目录，复制 `.env.example` 为 `.env` 并填入必需变量（`APP_ID/APP_SECRET`、`OPENAI_API_KEY/OPENAI_MODEL`）。
2. 按各语言 README / `DEVELOPMENT_GUIDE.zh.md` 运行。

## 🧩 How It Works | 工作原理（简版）

Remote MCP 的关键点是 **两类 Header**：

- `X-Lark-MCP-TAT`: 通过 OpenAPI 用 `APP_ID/APP_SECRET` 换取的 `tenant_access_token`
- `X-Lark-MCP-Allowed-Tools`: 允许调用的工具白名单（建议最小化）

各示例默认连接：`https://mcp.feishu.cn/mcp`（可通过 `MCP_URL` 覆盖）。

## 📚 Resources | 资源

- MCP: https://modelcontextprotocol.io/introduction
- Lark OpenAPI MCP: https://github.com/larksuite/lark-openapi-mcp
- Feishu Open Platform: https://open.feishu.cn/
- Lark Developer: https://open.larksuite.com/
