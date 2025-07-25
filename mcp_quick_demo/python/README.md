# MCP Quick Demo - Python Implementation

# MCP 快速演示 - Python 实现

## Overview | 概述

This project provides two different Python implementations for integrating with the Model Context Protocol (MCP). It demonstrates how to connect to a Lark MCP server and interact with Feishu documents using AI agents with both custom MCP clients and LangChain adapters.

本项目提供了两种不同的 Python 实现来集成模型上下文协议 (MCP)。它演示了如何连接到 Lark MCP 服务器，并使用自定义 MCP 客户端和 LangChain 适配器通过 AI Agent 与飞书/Lark 文档交互。

## Project Files | 项目文件

### Core Demos | 核心演示

1. **`mcp-use.py`** - Direct MCP implementation using mcp-use library
   使用 mcp-use 库的直接 MCP 实现

2. **`langchain-demo.py`** - LangChain-based implementation with MCP adapters
   基于 LangChain 的 MCP 适配器实现

### Supporting Files | 支持文件

- **`prompt.py`** - Shared prompt definitions | 共享提示词定义
- **`pyproject.toml`** - Project dependencies and configuration | 项目依赖和配置

## Prerequisites | 前置要求

- Python 3.13 or higher | Python 3.13 或更高版本
- Node.js (for Lark MCP server) | Node.js（用于 Lark MCP 服务器）
- OpenAI API key | OpenAI API 密钥
- Lark app credentials | 飞书/Lark 应用凭证

## Installation | 安装

1.  **Clone the repository | 克隆仓库**

    ```bash
    git clone https://github.com/larksuite/lark-samples
    cd mcp-quick-demo/python
    ```

2.  **Set up Python environment | 设置 Python 环境**

    Using uv (recommended) | 使用 uv（推荐）：

    ```bash
    uv sync
    ```

3.  **Set up environment variables | 设置环境变量**

    Create a `.env` file in the project root:
    在项目根目录创建 `.env` 文件：

    ```env
    # Required | 必需
    OPENAI_API_KEY=your_openai_api_key
    OPENAI_MODEL=gpt-4
    APP_ID=your_lark_app_id
    APP_SECRET=your_lark_app_secret

    # Optional | 可选
    OPENAI_BASE_URL=https://api.openai.com/v1
    ```

4.  **Feishu/Lark Application Configuration | 飞书/Lark/Lark 应用配置**

    Configure in Feishu/Lark Open Platform Developer Console:
    在 飞书/Lark/Lark 开放平台开发者后台中配置：

    1. **Create an app | 创建应用**
    2. **Bot Configuration | 机器人配置**

       - Enable bot functionality | 启用机器人功能

    3. **Permission Configuration | 权限配置**

       - Add necessary API permissions, like docx:docx | 添加必要的 API 权限，例如 docx:docx

    4. **Publish the app | 发布应用**

## Usage | 使用方法

### Option 1: MCP-Use Implementation | 选项 1：MCP-Use 实现

Run the MCP-Use implementation:
运行 MCP-Use 实现：

```bash
uv run src/mcp-use.py
```

This demo uses the `mcp-use` library for MCP integration.
此演示使用 `mcp-use` 库进行 MCP 集成。

### Option 2: LangChain Implementation | 选项 2：LangChain 实现

Run the LangChain-based implementation:
运行基于 LangChain 的实现：

```bash
uv run src/langchain-demo.py
```

This demo leverages LangChain's MCP adapters for a more framework-integrated approach.
此演示利用 LangChain 的 MCP 适配器进行更多框架集成的方法。

### Customizing Prompts | 自定义提示词

Edit the `prompt.py` file to modify the user query:
编辑 `prompt.py` 文件来修改用户查询：

```python
user_prompt = "Your custom query here"
```

## Project Structure | 项目结构

```
python/
├── src/mcp-use.py              # Direct MCP implementation | 直接 MCP 实现
├── src/langchain-demo.py       # LangChain MCP implementation | LangChain MCP 实现
├── src/prompt.py               # Shared prompts | 共享提示词
├── pyproject.toml          # Project configuration | 项目配置
├── uv.lock                 # Dependency lock file | 依赖锁定文件
└── .env                    # Environment variables | 环境变量
```

## Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **Missing Dependencies | 缺失依赖**

   ```
   ModuleNotFoundError: No module named 'mcp_use'
   ```

   Solution: Run `uv sync`
   解决方案：运行 `uv sync`

2. **Environment Variables Not Set | 环境变量未设置**

   ```
   ValueError: OPENAI_API_KEY, OPENAI_MODEL is required
   ```

   Solution: Create a `.env` file with all required variables
   解决方案：创建包含所有必需变量的 `.env` 文件

3. **MCP Server Connection Failed | MCP 服务器连接失败**
   ```
   ConnectionError: Failed to connect to MCP server
   ```
   Solution: Ensure Node.js is installed and Lark MCP server is accessible
   解决方案：确保已安装 Node.js 且 Lark MCP 服务器可访问

## 📚 Resources | 资源

### Documentation | 文档

- [LangChain MCP Adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- [LangChain](https://python.langchain.com/docs/)
- [MCP Use](https://mcp-use.com)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Feishu Open Platform](https://open.feishu.cn/)
- [Lark Developer](https://open.larksuite.com/)
- [Lark OpenAPI MCP](https://github.com/larksuite/lark-openapi-mcp)
