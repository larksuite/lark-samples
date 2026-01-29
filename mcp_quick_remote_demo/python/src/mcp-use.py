# mcp-use.py - mcp-use implementation demo
# mcp-use.py - mcp-use 实现演示


# If you need more information about mcp-use, please refer to https://mcp-use.com/
# 如果你需要更多关于 mcp-use 的信息，请参考 https://mcp-use.com/

import asyncio
import os
import lark_oapi as lark
from lark_oapi.api.auth.v3 import *
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


def get_tat():
    """
    Get Tenant Access Token from Lark/Feishu
    从飞书获取 Tenant Access Token
    """
    app_id = os.getenv("APP_ID")
    app_secret = os.getenv("APP_SECRET")

    if not app_id or not app_secret:
        raise ValueError("APP_ID and APP_SECRET are required")

    client = (
        lark.Client.builder()
        .app_id(app_id)
        .app_secret(app_secret)
        .domain(os.getenv("LARK_DOMAIN", "https://open.feishu.cn"))
        .build()
    )

    req = (
        InternalTenantAccessTokenRequest.builder()
        .request_body(
            InternalTenantAccessTokenRequestBody.builder()
            .app_id(app_id)
            .app_secret(app_secret)
            .build()
        )
        .build()
    )

    resp = client.auth.v3.tenant_access_token.internal(req)

    if not resp.success():
        raise Exception(f"Failed to get tenant access token: {resp.msg}")

    import json

    data = json.loads(resp.raw.content)
    return data.get("tenant_access_token")


def create_lark_mcp_client(tenant_access_token):
    """
    Create and configure Lark MCP client
    创建和配置 Lark MCP 客户端

    Returns:
        MCPClient: Configured MCP client instance
        MCPClient: 配置好的 MCP 客户端实例
    """
    # Get MCP URL and allowed tools from environment variables
    # 从环境变量获取 MCP URL 和允许使用的工具
    mcp_url = os.getenv("MCP_URL", "https://mcp.feishu.cn/mcp")
    allowed_tools = os.getenv("LARK_MCP_ALLOWED_TOOLS", "get-comments,fetch-doc")

    # Configure MCP client with HTTP transport
    # 配置带有 HTTP 传输的 MCP 客户端
    config = {
        "mcpServers": {
            "lark-mcp": {
                "type": "http",
                "url": mcp_url,
                "headers": {
                    # Pass allowed tools and TAT via headers
                    # 通过请求头传递允许的工具和 TAT
                    "X-Lark-MCP-Allowed-Tools": allowed_tools,
                    "X-Lark-MCP-TAT": tenant_access_token,
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
    # Get Tenant Access Token
    tat = get_tat()

    # Create MCP client and agent
    # 创建 MCP 客户端和Agent
    client = create_lark_mcp_client(tat)
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
