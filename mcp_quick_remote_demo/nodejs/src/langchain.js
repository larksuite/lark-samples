// langchain.js - LangChain with Lark OpenAPI MCP Demo
// langchain.js - LangChain 与 Lark OpenAPI MCP 适配器演示

// If you need more information about LangChain, please refer to https://js.langchain.com/docs/tutorials/
// 如果你需要更多关于 LangChain 的信息，请参考 https://js.langchain.com/docs/tutorials/

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { systemPrompt, userPrompt } from "./prompt.js";
import * as Lark from "@larksuiteoapi/node-sdk";

import dotenv from "dotenv";

// Load environment variables from .env file
// 从 .env 文件加载环境变量
dotenv.config();

// Validate required environment variables
// 验证必需的环境变量
if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
  throw new Error(
    "OPENAI_API_KEY, OPENAI_MODEL is required | OPENAI_API_KEY 和 OPENAI_MODEL 是必需的"
  );
}

// Create OpenAI model with support for multiple providers
// 创建支持多个提供商的 OpenAI 模型
const model = new ChatOpenAI({
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {
      // Adapt to different AI services | 适配不同的 AI 服务
      "api-key": process.env.OPENAI_API_KEY, // Azure OpenAI | Azure OpenAI
      "x-api-key": process.env.OPENAI_API_KEY, // Some providers | 某些提供商
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Standard format | 标准格式
    },
  },
  apiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.OPENAI_MODEL,
});

/**
 * Create and configure Lark MCP client using MultiServerMCPClient
 * 使用 MultiServerMCPClient 创建和配置 Lark MCP 客户端
 *
 * @returns {Promise<MultiServerMCPClient>} Configured MCP client | 配置好的 MCP 客户端
 */
async function createLarkMCPClient() {
  // Initialize Lark Client
  // 初始化飞书/Lark 客户端
  const client = new Lark.Client({
    appId: process.env.APP_ID,
    appSecret: process.env.APP_SECRET,
  });

  // Get Tenant Access Token
  // 获取 Tenant Access Token
  const tenantAccessToken = await client.tokenManager.getTenantAccessToken();

  // Get MCP URL and allowed tools from environment variables
  // 从环境变量获取 MCP URL 和允许使用的工具
  const mcpUrl = process.env.MCP_URL || "https://mcp.feishu.cn/mcp";
  const allowedTools =
    process.env.LARK_MCP_ALLOWED_TOOLS || "get-comments,fetch-doc";
    
  // Create MultiServerMCPClient with HTTP transport
  // 创建带有 HTTP 传输的 MultiServerMCPClient
  return new MultiServerMCPClient({
    mcpServers: {
      "lark-mcp": {
        transport: "http",
        url: mcpUrl,
        headers: {
          // Pass allowed tools and TAT via headers
          // 通过请求头传递允许的工具和 TAT
          "X-Lark-MCP-Allowed-Tools": allowedTools,
          "X-Lark-MCP-TAT": tenantAccessToken,
        },
      },
    },
  });
}

async function main() {
  const mcpClient = await createLarkMCPClient();
  const tools = await mcpClient.getTools();
  const agent = createAgent({ model, tools });

  console.log("🚀 调用 Agent | Invoke agent");
  try {
    const response = await agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    console.log(response);
  } catch (error) {
    console.error("Error during agent execution:", error);
  }

  await mcpClient.close();
}

main();
