# langchain-demo.py - LangChain MCP integration with Lark OpenAPI MCP demo
# langchain-demo.py - LangChain MCP 集成 Lark OpenAPI MCP 演示

# If you need more information about LangChain, please refer to https://python.langchain.com/docs/tutorials/
# 如果你需要更多关于 LangChain 的信息，请参考 https://python.langchain.com/docs/tutorials/

import asyncio
import os
import lark_oapi as lark
from lark_oapi.api.auth.v3 import *
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_core.tools import BaseTool
from langchain_core.messages import HumanMessage
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain.agents import create_agent
import dotenv
from prompt import user_prompt

# Load environment variables from .env file
# 从 .env 文件加载环境变量
dotenv.load_dotenv()

# Get configuration from environment variables
# 从环境变量获取配置
base_url = os.getenv(
    "OPENAI_BASE_URL"
)  # Custom OpenAI API base URL | 自定义 OpenAI API 基础 URL
api_key = os.getenv("OPENAI_API_KEY")  # OpenAI API key | OpenAI API 密钥
model_name = os.getenv("OPENAI_MODEL")  # Model name to use | 要使用的模型名称

# Validate required environment variables
# 验证必需的环境变量
if not api_key or not model_name:
    raise ValueError(
        "OPENAI_API_KEY, OPENAI_MODEL is required | OPENAI_API_KEY 和 OPENAI_MODEL 是必需的"
    )

# Initialize OpenAI model with custom configuration
# 使用自定义配置初始化 OpenAI 模型
model = ChatOpenAI(
    base_url=base_url,  # Custom base URL for different providers | 不同提供商的自定义基础 URL
    model=model_name,  # Specified model name | 指定的模型名称
    api_key=api_key,  # API authentication key | API 认证密钥
    default_headers={
        "Api-Key": api_key
    },  # Additional headers for compatibility | 兼容性的额外标头
    max_tokens=1000,  # Maximum tokens in response | 响应中的最大令牌数
    verbose=True,  # Enable verbose logging | 启用详细日志
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
    Create and configure Lark MCP client using MultiServerMCPClient
    使用 MultiServerMCPClient 创建和配置 Lark MCP 客户端

    Returns:
        MultiServerMCPClient: Configured MCP client instance for Lark integration
        MultiServerMCPClient: 用于飞书/Lark集成的配置好的 MCP 客户端实例
    """
    # Get MCP URL and allowed tools from environment variables
    # 从环境变量获取 MCP URL 和允许使用的工具
    mcp_url = os.getenv("MCP_URL", "https://mcp.feishu.cn/mcp")
    allowed_tools = os.getenv("LARK_MCP_ALLOWED_TOOLS", "get-comments,fetch-doc")

    # Create MultiServerMCPClient with HTTP transport
    # 创建带有 HTTP 传输的 MultiServerMCPClient
    return MultiServerMCPClient(
        {
            "lark-mcp": {  # Server identifier | 服务器标识符
                "transport": "http",
                "url": mcp_url,
                "headers": {
                    # Pass allowed tools and TAT via headers
                    # 通过请求头传递允许的工具和 TAT
                    "X-Lark-MCP-Allowed-Tools": allowed_tools,
                    "X-Lark-MCP-TAT": tenant_access_token,
                },
            }
        }
    )


async def main():
    """
    Main async function to run the LangChain MCP agent demo
    运行 LangChain MCP Agent演示的主异步函数
    """
    # Get Tenant Access Token
    tat = get_tat()

    # Create MCP client instance
    # 创建 MCP 客户端实例
    client = create_lark_mcp_client(tat)

    # Use async context manager to manage MCP session
    # 使用异步上下文管理器来管理 MCP 会话
    async with client.session("lark-mcp") as session:
        # Load MCP tools from the session
        # 从会话中加载 MCP 工具
        tools = await load_mcp_tools(session)

        # Create Agent with model and loaded tools
        # 使用模型和加载的工具创建 Agent
        agent = create_agent(model=model, tools=tools)

        print("🚀 调用Agent | Invoking agent")

        # Execute agent with user prompt and get response
        # 使用用户提示执行Agent并获取响应
        response = await agent.ainvoke({"messages": user_prompt})

        print("✅ Agent响应 | Agent response")
        print(f"\n结果 | Result: {response}")


if __name__ == "__main__":
    try:
        # Run the main async function
        # 运行主异步函数
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Exiting...")
