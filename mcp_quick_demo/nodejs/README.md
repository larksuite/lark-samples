# MCP Quick Demo - Node.js Implementation

# MCP 快速演示 - Node.js 实现

## Overview | 概述

This project showcases two different Node.js implementations for integrating with the Model Context Protocol (MCP). It demonstrates how to connect to a Lark MCP server and interact with Feishu documents using both the AI SDK and LangChain frameworks, providing flexibility in choosing your preferred AI integration approach.

本项目展示了两种不同的 Node.js 实现来集成模型上下文协议 (MCP)。它演示了如何连接到 Lark MCP 服务器，并使用 AI SDK 和 LangChain 框架与飞书/Lark 文档交互，为选择首选的 AI 集成方法提供了灵活性。

## Project Files | 项目文件

### Core Implementations | 核心实现

1. **`ai-sdk.js`** - Implementation using Vercel AI SDK with MCP transport
   使用 Vercel AI SDK 和 MCP 传输的实现

2. **`langchain.js`** - Implementation using LangChain with MCP adapters
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
   cd mcp_quick_demo/nodejs
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
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o
   APP_ID=your_lark_app_id
   APP_SECRET=your_lark_app_secret
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

This demo uses Vercel's AI SDK with MCP stdio transport for direct protocol communication.
此演示使用 Vercel 的 AI SDK 和 MCP stdio 传输进行直接协议通信。

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

如果您需要自定义启用的工具集，可以直接修改 `src/ai-sdk.js` 或 `src/langchain.js` 文件。在该文件中，您可以找到被注释掉的工具配置代码，取消注释并根据您的需求进行修改即可。

If you need to customize the enabled toolset, you can directly modify the `src/ai-sdk.js` or `src/langchain.js` file. In this file, you will find commented-out tool configuration code. Uncomment it and modify it according to your needs.

[Learn More](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/mcp_integration/advanced-configuration#74738783)

## Project Structure | 项目结构

```
node/
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

3. **MCP Server Connection Failed | MCP 服务器连接失败**
   ```
   Error: Failed to start MCP server
   ```
   Solution: Ensure Lark MCP package is accessible via npx
   解决方案：确保可以通过 npx 访问 Lark MCP 包

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
