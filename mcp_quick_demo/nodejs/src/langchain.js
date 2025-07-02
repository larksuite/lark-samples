// langchain.js - LangChain with Lark OpenAPI MCP Demo
// langchain.js - LangChain 与 Lark OpenAPI MCP 适配器演示

// If you need more information about LangChain, please refer to https://js.langchain.com/docs/tutorials/
// 如果你需要更多关于 LangChain 的信息，请参考 https://js.langchain.com/docs/tutorials/

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { systemPrompt, userPrompt } from "./prompt.js";

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
  return new MultiServerMCPClient({
    mcpServers: {
      "lark-mcp": {
        transport: "stdio", // Use stdio for process communication | 使用 stdio 进行进程通信
        command: "npx", // Use Node.js package runner | 使用 Node.js 包运行器
        args: [
          "-y",
          "@larksuiteoapi/lark-mcp",
          "mcp",
          "--token-mode",
          "tenant_access_token",
          // 你可以自定义开启的 Tools 或者 Presets / You can custom enable tools or presets here
          // '-t',
          // 'bitable.v1.app.create,bitable.v1.appTable.create',
        ],
        env: {
          // Lark app credentials for API access | 用于 API 访问的飞书/Lark应用凭证
          APP_ID: process.env.APP_ID,
          APP_SECRET: process.env.APP_SECRET,
          LARK_DOMAIN: process.env.LARK_DOMAIN, // Feishu/Lark request domain | 飞书/Lark API 请求域名
        },
      },
    },
  });
}

async function main() {
  const mcpClient = await createLarkMCPClient();
  const tools = await mcpClient.getTools();
  const agent = createReactAgent({ llm: model, tools });

  console.log("🚀 invoke agent");
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
