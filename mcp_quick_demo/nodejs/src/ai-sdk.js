// ai-sdk.js - Vercel AI SDK with Lark OpenAPI MCP Demo
// ai-sdk.js - Vercel AI SDK 与 Lark OpenAPI MCP 适配器演示

// If you need more information about Vercel AI SDK, please refer to https://ai-sdk.dev/docs/introduction
// 如果你需要更多关于 Vercel AI SDK 的信息，请参考 https://ai-sdk.dev/docs/introduction

import {
  experimental_createMCPClient as createMCPClient,
  streamText,
} from "ai";
// @ts-ignore
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "ai/mcp-stdio";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
 * Create and configure Lark MCP client with stdio transport
 * 使用 stdio 传输创建和配置 Lark MCP 客户端
 *
 * @returns {Promise<MCPClient>} Configured MCP client | 配置好的 MCP 客户端
 */
async function createLarkMCPClient() {
  let command = "npx";
  let args = [
    "-y",
    "@larksuiteoapi/lark-mcp",
    "mcp",
    "--token-mode",
    "tenant_access_token",
    // 你可以自定义开启的 Tools 或者 Presets / You can custom enable tools or presets here
    // '-t',
    // 'bitable.v1.app.create,bitable.v1.appTable.create',
  ];

  // Use Windows platform to run npx command with cmd.exe | 使用 Windows 平台运行 npx 命令
  if (process.platform === "win32") {
    args = ["/c", command, ...args];
    command = "cmd.exe";
  }

  const transport = new StdioMCPTransport({
    transport: "stdio", // Use stdio for process communication | 使用 stdio 进行进程通信
    command, // Use Node.js package runner | 使用 Node.js 包运行器
    args, // Auto-yes and package name | 自动确认和包名
    env: {
      // Lark app credentials for API access | 用于 API 访问的飞书/Lark应用凭证
      APP_ID: process.env.APP_ID,
      APP_SECRET: process.env.APP_SECRET,
      LARK_DOMAIN: process.env.LARK_DOMAIN, // Feishu/Lark request domain | 飞书/Lark API 请求域名
    },
  });
  return createMCPClient({ transport });
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
