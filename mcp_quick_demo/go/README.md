# MCP Quick Demo - Go Implementation

# MCP 快速演示 - Go 实现

## Overview | 概述

This project demonstrates how to integrate with the Model Context Protocol (MCP) using Go. It showcases connecting to a Lark MCP server to access Feishu documents and other tools through an AI agent.

本项目演示了如何使用 Go 语言集成模型上下文协议 (MCP)。它展示了如何连接到 Lark MCP 服务器，通过 AI Agent 访问飞书/Lark 文档和其他工具。

## Prerequisites | 前置要求

- Go 1.24.1 or higher | Go 1.24.1 或更高版本
- Node.js (for Lark MCP server) | Node.js（用于 Lark MCP 服务器）
- OpenAI API key | OpenAI API 密钥
- Lark app credentials | 飞书/Lark 应用凭证

## Installation | 安装

1. **Clone the repository | 克隆仓库**

   ```bash
   git clone https://github.com/larksuite/lark-samples
   cd mcp_quick_demo/go
   ```

2. **Install dependencies | 安装依赖**

   ```bash
   go mod tidy
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

1. **Run the application | 运行应用**

   ```bash
   go run .
   ```

2. **Customize the prompt | 自定义提示词**

   Edit the `prompt/prompt.go` file to modify the user query:
   编辑 `prompt/prompt.go` 文件来修改用户查询：

   ```go
   const UserPrompt = "Your custom query here"
   ```


### 自定义工具 / Customizing Tools

如果您需要自定义启用的工具集，可以直接修改 `app/application.go` 文件。在该文件中，您可以找到被注释掉的工具配置代码，取消注释并根据您的需求进行修改即可。

If you need to customize the enabled toolset, you can directly modify the `app/application.go` file. In this file, you will find commented-out tool configuration code. Uncomment it and modify it according to your needs.

[Learn More](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/mcp_integration/advanced-configuration#74738783)

## Project Structure | 项目结构

```
go/
├── main.go                 # Entry point | 入口文件
├── go.mod                  # Go module file | Go 模块文件
├── go.sum                  # Dependencies checksum | 依赖校验和
├── app/                    # Application logic | 应用逻辑
│   ├── application.go      # Main application | 主应用程序
│   └── openai_client.go    # OpenAI client | OpenAI 客户端
└── prompt/                 # Prompt definitions | 提示词定义
    └── prompt.go           # User and system prompts | 用户和系统提示词
```

## How it Works | 工作原理

1. **Initialization | 初始化**: The application initializes the Lark MCP client and OpenAI client
   应用程序初始化 Lark MCP 客户端和 OpenAI 客户端

2. **Tool Discovery | 工具发现**: Retrieves available tools from the MCP server
   从 MCP 服务器检索可用工具

3. **Query Processing | 查询处理**: Sends user query to OpenAI with available tools
   将用户查询和可用工具发送给 OpenAI

4. **Tool Execution | 工具执行**: Executes tools as needed based on AI responses
   根据 AI 响应按需执行工具

5. **Response Generation | 响应生成**: Returns the final response to the user
   向用户返回最终响应

## Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **Environment Variables Not Set | 环境变量未设置**

   ```
   Error: Required environment variable OPENAI_API_KEY is not set
   ```

   Solution: Create a `.env` file with all required variables
   解决方案：创建包含所有必需变量的 `.env` 文件

2. **MCP Server Connection Failed | MCP 服务器连接失败**

   ```
   Error: Failed to connect to MCP server
   ```

   Solution: Ensure Node.js is installed and Lark MCP server is accessible
   解决方案：确保已安装 Node.js 且 Lark MCP 服务器可访问

3. **OpenAI API Error | OpenAI API 错误**
   ```
   Error: OpenAI API request failed
   ```
   Solution: Check your API key and model configuration
   解决方案：检查您的 API 密钥和模型配置

## 📚 Resources | 资源

### Documentation | 文档

- [MCP GO](https://mcp-go.dev/clients)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Feishu Open Platform](https://open.feishu.cn/)
- [Lark Developer](https://open.larksuite.com/)
- [Lark OpenAPI MCP](https://github.com/larksuite/lark-openapi-mcp)
