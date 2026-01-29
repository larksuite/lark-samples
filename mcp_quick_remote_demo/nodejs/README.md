# MCP Quick Remote Demo - Node.js

# MCP 远程接入快速演示 - Node.js

## Overview | 概述

This project showcases two different Node.js implementations for integrating with **Remote / HTTP MCP**. It demonstrates how to connect to the Lark/Feishu OpenAPI MCP endpoint and interact with Feishu docs using both the AI SDK and LangChain frameworks.

本项目展示了两种不同的 Node.js 实现来集成 **远程（HTTP）MCP**。它演示了如何连接到飞书/Lark OpenAPI MCP 远程 Endpoint，并通过 AI SDK 与 LangChain 在对话中触发工具调用。

## Project Files | 项目文件

### Core Implementations | 核心实现

1. **`src/ai-sdk.js`** - Vercel AI SDK + MCP（HTTP transport）
   使用 Vercel AI SDK 和 MCP 传输的实现

2. **`src/langchain.js`** - LangChain + MCP adapters（HTTP transport）
   使用 LangChain 和 MCP 适配器的实现

### Supporting Files | 支持文件

- **`prompt.js`** - Shared prompt definitions for both implementations
  两种实现的共享提示词定义
- **`package.json`** - Project dependencies and scripts
  项目依赖和脚本

## Prerequisites | 前置要求

- Node.js 20+ (with ES modules support) | Node.js 20+（支持 ES 模块）
- npm package manager | npm 包管理器
- OpenAI API key | OpenAI API 密钥
- Lark app credentials | 飞书/Lark 应用凭证

## Installation | 安装

1. **Clone the repository | 克隆仓库**

   ```bash
   git clone https://github.com/larksuite/lark-samples
   cd lark-samples/mcp_quick_remote_demo/nodejs
   ```

2. **Install dependencies | 安装依赖**

   Using npm | 使用 npm：

   ```bash
   npm install
   ```

3. **Set up environment variables | 设置环境变量**

   Create a `.env` file in the project root:
   在项目根目录创建 `.env` 文件：

   ```env
   APP_ID=cli_xxx
   APP_SECRET=xxx
   LARK_DOMAIN=https://open.feishu.cn
   MCP_URL=https://mcp.feishu.cn/mcp
   LARK_MCP_ALLOWED_TOOLS=create-doc,fetch-doc

   OPENAI_API_KEY=sk-xxx
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_BASE_URL=https://api.openai.com/v1
   ```

4. **Feishu/Lark Application Configuration | 飞书/Lark/Lark 应用配置**

   Configure in Feishu/Lark Open Platform Developer Console:
   在 飞书/Lark/Lark 开放平台开发者后台中配置：

   1. **Create an app | 创建应用**
   2. **Bot Configuration | 机器人配置**

      - Enable bot functionality | 启用机器人功能

   3. **Permission Configuration | 权限配置**

      - Add necessary API permissions, like docx:docx | 添加必要的 API 权限，例如 docx:docx

   4. **Publish the app | 发布应用**

## Usage | 使用方法

### Option 1: AI SDK Implementation | 选项 1：AI SDK 实现

Run the AI SDK-based implementation:
运行基于 AI SDK 的实现：

```bash
npm run dev:ai
```

This demo uses Vercel's AI SDK with MCP **HTTP** transport.
此演示使用 Vercel 的 AI SDK + MCP **HTTP** 传输（Remote MCP）。

### Option 2: LangChain Implementation | 选项 2：LangChain 实现

Run the LangChain-based implementation:
运行基于 LangChain 的实现：

```bash
npm run dev:langchain
```

This demo leverages LangChain's MCP adapters with ReAct agent pattern.
此演示利用 LangChain 的 MCP 适配器和 ReAct Agent 模式。

### Customizing Prompts | 自定义提示词

Edit the `prompt.js` file to modify queries:
编辑 `prompt.js` 文件来修改查询：

```javascript
export const userPrompt = "Your custom query here";
export const systemPrompt = "Your system instructions here";
```

### 自定义工具 / Customizing Tools

推荐优先通过环境变量收敛工具面：在 `.env` 中设置 `LARK_MCP_ALLOWED_TOOLS`（逗号分隔）。

If you need to customize enabled tools, prefer setting `LARK_MCP_ALLOWED_TOOLS` in `.env` (comma-separated).

[Learn More](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/mcp_integration/advanced-configuration#74738783)

## Project Structure | 项目结构

```
nodejs/
├── package.json               # Dependencies and scripts | 依赖和脚本
├── .env                       # Environment variables | 环境变量
├───src/ai-sdk.js              # AI SDK implementation | AI SDK 实现
├───src/langchain.js           # LangChain implementation | LangChain 实现
└───src/prompt.js              # Shared prompts | 共享提示词
```

## Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **Missing Dependencies | 缺失依赖**

   ```
   Error: Cannot find module 'ai'
   ```

   Solution: Run `npm install` to install all dependencies
   解决方案：运行 `npm install` 安装所有依赖项

2. **Environment Variables Not Set | 环境变量未设置**

   ```
   Error: OPENAI_API_KEY, OPENAI_MODEL is required
   ```

   Solution: Create a `.env` file with all required variables
   解决方案：创建包含所有必需变量的 `.env` 文件

3. **MCP Connection Failed | MCP 连接失败**
   ```
   Error: Failed to connect to MCP
   ```
   Solution: Check `MCP_URL` reachability and required headers (`X-Lark-MCP-TAT`, `X-Lark-MCP-Allowed-Tools`)
   解决方案：检查 `MCP_URL` 连通性与请求头（`X-Lark-MCP-TAT` / `X-Lark-MCP-Allowed-Tools`）

## 📚 Resources | 资源

### Documentation | 文档

- [LangChain MCP Adapters](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)
- [LangChain](https://js.langchain.com/docs/)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Feishu Open Platform](https://open.feishu.cn/)
- [Lark Developer](https://open.larksuite.com/)
- [Lark OpenAPI MCP](https://github.com/larksuite/lark-openapi-mcp)
