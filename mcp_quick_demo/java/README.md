# MCP Quick Demo - Java Implementation

# MCP 快速演示 - Java 实现

## Overview | 概述

This project demonstrates how to integrate with the Model Context Protocol (MCP) using Java and Spring Boot. It showcases a complete Spring AI implementation that connects to a Lark MCP server to access Feishu documents and other tools through an AI-powered application.

本项目演示了如何使用 Java 和 Spring Boot 集成模型上下文协议 (MCP)。它展示了一个完整的 Spring AI 实现，连接到 Lark MCP 服务器，通过 AI 驱动的应用程序访问飞书/Lark 文档和其他工具。

## Prerequisites | 前置要求

- Java 17 or higher | Java 17 或更高版本
- Maven 3.6+ | Maven 3.6+
- Node.js (for Lark MCP server) | Node.js（用于 Lark MCP 服务器）
- OpenAI API key | OpenAI API 密钥
- Lark app credentials | 飞书/Lark 应用凭证

## Installation | 安装

1. **Clone the repository | 克隆仓库**

   ```bash
   git clone https://github.com/larksuite/lark-samples
   cd mcp-quick-demo/java
   ```

2. **Set up environment variables | 设置环境变量**

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

3. **Build the project | 构建项目**

   ```bash
   ./mvnw clean compile
   ```

4. **Feishu/Lark Application Configuration | 飞书/Lark/Lark 应用配置**

   Configure in Feishu/Lark Open Platform Developer Console:
   在 飞书/Lark/Lark 开放平台开发者后台中配置：

   1. **Create an app | 创建应用**
   2. **Bot Configuration | 机器人配置**

      - Enable bot functionality | 启用机器人功能

   3. **Permission Configuration | 权限配置**

      - Add necessary API permissions, like docx:docx | 添加必要的 API 权限，例如 docx:docx

   4. **Publish the app | 发布应用**

## Usage | 使用方法

### Running the Application | 运行应用程序

**Using Maven wrapper | 使用 Maven 包装器**

```bash
./mvnw spring-boot:run
```

### Customizing the Query | 自定义查询

Edit the `ai.user.input` property in `application.properties`:
编辑 `application.properties` 中的 `ai.user.input` 属性：

```properties
ai.user.input=Your custom query here
```

## Project Structure | 项目结构

```
java/
├── pom.xml                                 # Maven configuration | Maven 配置
├── mvnw, mvnw.cmd                         # Maven wrapper | Maven 包装器
├── src/
│   └── main/
│       ├── java/com/larksuite/ai/mcp/samples/client/
│       │   ├── Application.java           # Main application | 主应用程序
│       │   └── WebClientHeaderConfig.java # HTTP configuration | HTTP 配置
│       └── resources/
│           └── application.properties     # Application configuration | 应用配置
└── target/                                # Build output | 构建输出
```

## Configuration | 配置

### Application Properties | 应用程序属性

The application uses `application.properties` for configuration:
应用程序使用 `application.properties` 进行配置：

```properties
# Spring Boot Configuration | Spring Boot 配置
spring.application.name=mcp
spring.main.web-application-type=none

# OpenAI Configuration | OpenAI 配置
spring.ai.openai.api-key=${OPENAI_API_KEY}
spring.ai.openai.base-url=${OPENAI_BASE_URL}
spring.ai.openai.chat.options.model=${OPENAI_MODEL}

# MCP Client Configuration | MCP 客户端配置
spring.ai.mcp.client.stdio.connections.lark.command=npx
spring.ai.mcp.client.stdio.connections.lark.args=-y,@larksuiteoapi/lark-mcp,mcp,--token-mode,tenant_access_token
spring.ai.mcp.client.stdio.connections.lark.env.APP_ID=${APP_ID}
spring.ai.mcp.client.stdio.connections.lark.env.APP_SECRET=${APP_SECRET}

# MCP Client Settings | MCP 客户端设置
spring.ai.mcp.client.toolcallback.enabled=true
spring.ai.mcp.client.stdio.connection-timeout=30s
spring.ai.mcp.client.stdio.read-timeout=30s

# User Input | 用户输入
ai.user.input=Please read the feishu document of https://feishu.feishu.cn/docx/WtwHdAngzoEU9IxyfhtcYsHCnDe by app
```

## Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **Maven Build Failure | Maven 构建失败**

   ```
   Error: Could not resolve dependencies
   ```

   Solution: Run `./mvnw clean install` to rebuild dependencies
   解决方案：运行 `./mvnw clean install` 重新构建依赖项

2. **Environment Variables Not Set | 环境变量未设置**

   ```
   Error: Required property 'spring.ai.openai.api-key' is not set
   ```

   Solution: Create a `.env` file with all required variables
   解决方案：创建包含所有必需变量的 `.env` 文件

3. **MCP Server Connection Failed | MCP 服务器连接失败**
   ```
   Error: Failed to start MCP client
   ```
   Solution: Ensure Node.js is installed and Lark MCP server is accessible
   解决方案：确保已安装 Node.js 且 Lark MCP 服务器可访问

## 📚 Resources | 资源

### Documentation | 文档

- [Spring MCP Client Boot Starter](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-client-boot-starter-docs.html)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Feishu Open Platform](https://open.feishu.cn/)
- [Lark Developer](https://open.larksuite.com/)
- [Lark OpenAPI MCP](https://github.com/larksuite/lark-openapi-mcp)
