# langchain-demo.py - LangChain MCP integration with Lark OpenAPI MCP demo
# langchain-demo.py - LangChain MCP 集成 Lark OpenAPI MCP 演示

# If you need more information about LangChain, please refer to https://python.langchain.com/docs/tutorials/
# 如果你需要更多关于 LangChain 的信息，请参考 https://python.langchain.com/docs/tutorials/

import asyncio
import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_core.tools import BaseTool
from langchain_core.messages import HumanMessage
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent
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


def create_lark_mcp_client():
    """
    Create and configure Lark MCP client using MultiServerMCPClient
    使用 MultiServerMCPClient 创建和配置 Lark MCP 客户端

    Returns:
        MultiServerMCPClient: Configured MCP client instance for Lark integration
        MultiServerMCPClient: 用于飞书/Lark集成的配置好的 MCP 客户端实例
    """
    return MultiServerMCPClient(
        {
            "lark-mcp": {  # Server identifier | 服务器标识符
                "transport": "stdio",  # Use stdio transport protocol | 使用标准输入输出传输协议
                "command": "npx",  # Use Node.js package runner | 使用 Node.js 包运行器
                "args": [
                    "-y",
                    "@larksuiteoapi/lark-mcp",
                    "mcp",
                    "--token-mode",
                    "tenant_access_token",
                ],  # Auto-yes and package args | 自动确认和包参数
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
    )


async def main():
    """
    Main async function to run the LangChain MCP agent demo
    运行 LangChain MCP Agent演示的主异步函数
    """
    # Create MCP client instance
    # 创建 MCP 客户端实例
    client = create_lark_mcp_client()

    # Use async context manager to manage MCP session
    # 使用异步上下文管理器来管理 MCP 会话
    async with client.session("lark-mcp") as session:
        # Load MCP tools from the session
        # 从会话中加载 MCP 工具
        tools = await load_mcp_tools(session)

        # Create ReAct agent with model and loaded tools
        # 使用模型和加载的工具创建 ReAct Agent
        agent = create_react_agent(model=model, tools=tools)

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
