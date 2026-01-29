# LangChain4j Remote MCP Demo (Java)

# LangChain4j 远程 MCP 演示 (Java)

## Overview | 概述

This project demonstrates a minimal runnable version of **LangChain4j + Feishu/Lark OpenAPI MCP (Remote / HTTP)** in `mcp_quick_remote_demo/java`.

本项目在 `mcp_quick_remote_demo/java` 下实现 **LangChain4j + 飞书/Lark OpenAPI MCP（Remote / HTTP）** 的最小可运行版本。

### References | 参考

- NodeJS Remote Demo: `mcp_quick_remote_demo/nodejs`
- Java Quick Demo (stdio): `mcp_quick_demo/java`

## Prerequisites | 前置要求

- Java 17+
- Maven 3.6+
- OpenAI API Key | OpenAI API 密钥
- Lark App Credentials | 飞书/Lark 应用凭证 (App ID & App Secret)

## Configuration | 配置

Create a `.env` file in the project root (copy from `.env.example`):
在本目录创建 `.env`（可从 `.env.example` 复制）：

- `APP_ID` / `APP_SECRET`: Used to exchange for `tenant_access_token` | 用于换取 `tenant_access_token`
- `OPENAI_API_KEY` / `OPENAI_MODEL`: OpenAI compatible model configuration | OpenAI 兼容模型配置
- `OPENAI_BASE_URL`: Optional, for self-hosted/third-party gateways (e.g. `/v1`) | 可选，兼容自建/第三方网关（例如 `/v1`）
- `LARK_DOMAIN`: Optional, default `https://open.feishu.cn` | 可选，默认 `https://open.feishu.cn`
- `MCP_URL`: Optional, default `https://mcp.feishu.cn/mcp` | 可选，默认 `https://mcp.feishu.cn/mcp`
- `LARK_MCP_ALLOWED_TOOLS`: Optional, default `create-doc,fetch-doc` | 可选，默认 `create-doc,fetch-doc`

## Usage | 使用方法

Run the application:
运行程序：

```bash
cd mcp_quick_remote_demo/java
mvn -q -DskipTests exec:java
```

### Process Flow | 执行流程

1. Exchange `tenant_access_token` using `APP_ID/APP_SECRET`
   用 `APP_ID/APP_SECRET` 换取 `tenant_access_token`
2. Connect to Remote MCP (HTTP) to fetch tools and execute chat
   使用 Remote MCP（HTTP）拉取工具并执行对话
3. Model triggers tool calls like `fetch-doc` during chat and returns final answer
   在对话过程中由模型触发 `fetch-doc` 等工具调用并返回最终回答

## Troubleshooting | 故障排除

### Common Issues | 常见问题

**Authentication Headers Issue | 鉴权 Header 问题**

Different model providers may require different authentication headers. This demo automatically injects three common headers simultaneously:
模型供应商不同可能导致鉴权 header 不一致。本示例会同时注入以下三种常见 header：

- `Authorization: Bearer <key>`
- `api-key: <key>`
- `x-api-key: <key>`
