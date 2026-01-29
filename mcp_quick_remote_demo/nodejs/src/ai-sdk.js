// ai-sdk.js - Vercel AI SDK with Lark OpenAPI MCP Demo
// ai-sdk.js - Vercel AI SDK 与 Lark OpenAPI MCP 适配器演示
// If you need more information about Vercel AI SDK, please refer to https://ai-sdk.dev/docs/introduction
// 如果你需要更多关于 Vercel AI SDK 的信息，请参考 https://ai-sdk.dev/docs/introduction

import { streamText } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

// Initialize OpenAI-compatible model with custom headers
// 使用自定义标头初始化 OpenAI 兼容模型
const model = createOpenAICompatible({
  baseURL: process.env.OPENAI_BASE_URL || "",
  name: process.env.OPENAI_MODEL || "",
  apiKey: process.env.OPENAI_API_KEY || "",
  headers: {
    "api-key": process.env.OPENAI_API_KEY || "", // Support for Azure OpenAI and other providers | 支持 Azure OpenAI 和其他提供商
  },
}).chatModel(process.env.OPENAI_MODEL || "");

/**
 * Create and configure Lark MCP client with http transport
 * 使用 http 传输创建和配置 Lark MCP 客户端
 *
 * @returns {Promise<MCPClient>} Configured MCP client | 配置好的 MCP 客户端
 */
async function createLarkMCPClient() {
  const client = new Lark.Client({
    appId: process.env.APP_ID,
    appSecret: process.env.APP_SECRET,
  });
  const tenantAccessToken = await client.tokenManager.getTenantAccessToken();

  const mcpUrl = process.env.MCP_URL || "https://mcp.feishu.cn/mcp";
  const allowedTools =
    process.env.LARK_MCP_ALLOWED_TOOLS || "create-doc,fetch-doc";

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: mcpUrl,
      headers: {
        "X-Lark-MCP-Allowed-Tools": allowedTools,
        "X-Lark-MCP-TAT": tenantAccessToken,
      },
    },
  });
  return mcpClient;
}

/**
 * Main async function to run the AI SDK MCP demo with streaming
 * 运行 AI SDK MCP 演示的主异步函数（支持流式处理）
 */
async function main() {
  // Create MCP client and get available tools
  // 创建 MCP 客户端并获取可用工具
  const mcpClient = await createLarkMCPClient();
  const tools = await mcpClient.tools();

  console.log("🚀 调用流式文本 | Invoke streamText");

  const stream = streamText({
    model: model,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxSteps: 10,
    tools,
    onChunk: (chunk) => {
      if (chunk.chunk.type === "text-delta") {
        process.stdout.write(chunk.chunk.textDelta);
      } else if (chunk.chunk.type === "tool-call") {
        console.log("🔧 Tool Call");
        console.log(chunk.chunk);
      } else if (chunk.chunk.type === "tool-result") {
        console.log("🔧 Tool Result");
        console.log(chunk.chunk);
      }
    },
    onStepFinish: () => {
      console.log("✅ Step Finish");
    },
    onFinish: () => {
      console.log("✅ All Finish");
    },
  });

  await stream.consumeStream();
  process.exit(0);
}

main();
