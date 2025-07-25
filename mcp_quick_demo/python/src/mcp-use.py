# mcp-use.py - mcp-use implementation demo
# mcp-use.py - mcp-use 实现演示


# If you need more information about mcp-use, please refer to https://mcp-use.com/
# 如果你需要更多关于 mcp-use 的信息，请参考 https://mcp-use.com/

import asyncio
import os
from langchain_openai import ChatOpenAI
from mcp_use import MCPAgent, MCPClient
import dotenv
from prompt import user_prompt, system_prompt

# Load environment variables from .env file
# 从 .env 文件加载环境变量
dotenv.load_dotenv()

# Get configuration from environment variables
# 从环境变量获取配置
base_url = os.getenv("OPENAI_BASE_URL")
api_key = os.getenv("OPENAI_API_KEY")
model_name = os.getenv("OPENAI_MODEL")

# Validate required environment variables
# 验证必需的环境变量
if not api_key or not model_name:
    raise ValueError(
        "OPENAI_API_KEY, OPENAI_MODEL is required | OPENAI_API_KEY 和 OPENAI_MODEL 是必需的"
    )

# Initialize OpenAI model with custom headers for different providers
# 使用自定义标头为不同提供商初始化 OpenAI 模型
model = ChatOpenAI(
    base_url=base_url,
    model=model_name,
    api_key=api_key,
    default_headers={
        "Api-Key": api_key
    },  # Support for various API providers | 支持各种 API 提供商
    max_tokens=1000,
    verbose=True,
)


def create_lark_mcp_client():
    """
    Create and configure Lark MCP client
    创建和配置 Lark MCP 客户端

    Returns:
        MCPClient: Configured MCP client instance
        MCPClient: 配置好的 MCP 客户端实例
    """
    config = {
        "mcpServers": {
            "lark-mcp": {
                "command": "npx",  # Use Node.js package runner | 使用 Node.js 包运行器
                "args": [
                    "-y",
                    "@larksuiteoapi/lark-mcp",
                    "mcp",
                    "--token-mode",
                    "tenant_access_token",
                ],  # Auto-yes and package name | 自动确认和包名
                "env": {
                    # Lark app credentials for API access | 用于 API 访问的飞书/Lark应用凭证
                    "APP_ID": os.getenv("APP_ID"),
                    "APP_SECRET": os.getenv("APP_SECRET"),
                    "LARK_DOMAIN": os.getenv(
                        "LARK_DOMAIN"
                    ),  #  Feishu/Lark request domain | 飞书/Lark API 请求域名
                },
            }
        }
    }
    return MCPClient.from_dict(config)


async def main():
    """
    Main async function to run the MCP agent demo
    运行 MCP Agent演示的主异步函数
    """
    # Create MCP client and agent
    # 创建 MCP 客户端和Agent
    client = create_lark_mcp_client()
    agent = MCPAgent(
        llm=model,
        client=client,
        max_steps=10,
        system_prompt=system_prompt,
    )  # Limit execution steps | 限制执行步骤

    print("🚀 调用Agent | Invoking agent")
    result = await agent.run(
        query=user_prompt,
    )
    print("✅ Agent响应 | Agent response")
    print(f"\n结果 | Result: {result}")


if __name__ == "__main__":
    try:
        # Run the main async function
        # 运行主异步函数
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Exiting...")
        exit(0)
