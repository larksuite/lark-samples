# MCP Quick Demo

# MCP 快速演示

## Overview | 概述

A comprehensive collection of Model Context Protocol (MCP) integration examples across multiple programming languages and frameworks. This repository demonstrates how to connect to Lark MCP servers and interact with Feishu documents using AI agents in Go, Python, Java, and Node.js.

一个全面的模型上下文协议 (MCP) 集成示例集合，涵盖多种编程语言和框架。本仓库演示了如何在 Go、Python、Java 和 Node.js 中连接到 Lark MCP 服务器并使用 AI 与飞书/Lark 文档交互。

## 📁 Project Structure | 项目结构

```
mcp-quick-demo/
├── go/                     # Go implementation | Go 实现
│   ├── main.go
│   ├── app/
│   ├── prompt/
│   └── README.md
├── python/                 # Python implementation | Python 实现
│   ├── src/
│   │    ├── mcp-use.py
│   │    ├── langchain-demo.py
│   │    └── prompt.py
│   └── README.md
├── java/                   # Java implementation | Java 实现
│   ├── src/
│   ├── pom.xml
│   └── README.md
├── node/                   # Node.js implementation | Node.js 实现
│   ├── src/
│   │    ├── ai-sdk.js
│   │    ├── langchain.js
│   │    └── prompt.js
│   └── README.md
└── README.md               # This file | 本文件
```

## 🚀 Quick Start | 快速开始

### Prerequisites | 前置要求

1. **Node.js** (for Lark MCP server) | **Node.js**（用于 Lark MCP 服务器）

   ```bash
   node --version  # Should be 20+ | 应该是 20+
   ```

2. OpenAI API key | OpenAI API 密钥

3. Lark app credentials | 飞书/Lark 应用凭证

4. Runtime for each language, you can refer to the README.md file in each language directory | 每种语言的运行时环境，详细可以参考各语言的 README.md 文件

### Environment Setup | 环境设置

Create a `.env` file in any project directory:
在任何项目目录中创建 `.env` 文件：

```env
APP_ID=your_lark_app_id
APP_SECRET=your_lark_app_secret
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Choose Your Language and Framework | 选择您的语言和框架

#### 🐹 Go - mcp-go

```bash
cd go
go mod tidy
go run .
```

#### 🐍 Python - mcp-use

```bash
cd python
uv sync
uv run src/mcp-use.py
```

#### 🐍 Python - langchain

```bash
cd python
uv sync
uv run src/langchain-demo.py
```

#### ☕ Java - Spring AI

```bash
cd java
mvn spring-boot:run
```

#### 🟨 Node.js - ai-sdk

```bash
cd nodejs
npm install
npm run dev:ai
```

#### 🟨 Node.js - langchain

```bash
cd nodejs
npm install
npm run dev:langchain
```

## 🛠️ How It Works | 工作原理

### Architecture Overview | 架构概览

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Application│    │   MCP Client    │    │   Lark MCP      │
│                 │    │                 │    │   Server        │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │    LLM    │  │◄──►│  │    MCP    │  │◄──►│  │  Feishu   │  │
│  │   Model   │  │    │  │ Protocol  │  │    │  │   Tools   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Workflow | 工作流程

1. **Initialization | 初始化**: Connect to Lark MCP server
   连接到 Lark MCP 服务器

2. **Tool Discovery | 工具发现**: Retrieve available tools from MCP server
   从 MCP 服务器检索可用工具

3. **Query Processing | 查询处理**: Send user query to AI model with tools
   将用户查询和工具发送给 AI 模型

4. **Tool Execution | 工具执行**: Execute required tools based on AI response
   根据 AI 响应执行所需工具

5. **Response Generation | 响应生成**: Return final response to user
   向用户返回最终响应

## 🔧 Configuration | 配置

### Lark MCP Server | Lark MCP 服务器

All implementations connect to the same Lark MCP server:
所有实现都连接到同一个 Lark MCP 服务器：

```bash
npx -y @larksuiteoapi/lark-mcp mcp
```

## 🐛 Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **MCP Server Not Starting** | **MCP 服务器无法启动**

   ```bash
   # Check Node.js installation | 检查 Node.js 安装
   node --version
   npm --version

   # Install Lark MCP manually | 手动安装 Lark MCP
   npm install -g @larksuiteoapi/lark-mcp
   ```

2. **Environment Variables Not Loaded** | **环境变量未加载**

   ```bash
   # Check environment variables | 检查环境变量
   echo $OPENAI_API_KEY
   echo $OPENAI_MODEL

   # Source environment file | 加载环境文件
   source .env
   ```

## 📚 Resources | 资源

### Documentation | 文档

- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [Feishu Open Platform](https://open.feishu.cn/)
- [Lark Developer](https://open.larksuite.com/)
- [Lark OpenAPI MCP](https://github.com/larksuite/lark-openapi-mcp)
- [LangChain MCP Adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- [LangChain](https://python.langchain.com/docs/)
- [MCP Use](https://mcp-use.com)
- [OpenAI API Documentation](https://platform.openai.com/docs)
