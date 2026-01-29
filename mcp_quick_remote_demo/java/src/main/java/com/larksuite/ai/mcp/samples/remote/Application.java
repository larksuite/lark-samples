package com.larksuite.ai.mcp.samples.remote;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.mcp.McpToolProvider;
import dev.langchain4j.mcp.client.DefaultMcpClient;
import dev.langchain4j.mcp.client.McpClient;
import dev.langchain4j.mcp.client.transport.McpTransport;
import dev.langchain4j.mcp.client.transport.http.StreamableHttpMcpTransport;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.tool.ToolProvider;
import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Main Application class for LangChain4j + MCP + Lark/Feishu Demo
 * LangChain4j + MCP + 飞书/Lark 演示的主应用程序类
 */
public class Application {

    interface Assistant {
        String chat(String message);
    }

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public static void main(String[] args) throws Exception {
        // Load environment variables from .env file
        // 从 .env 文件加载环境变量
        loadDotenvToSystemProperties();

        // Get configuration from environment variables
        // 从环境变量获取配置
        String appId = requireEnv("APP_ID");
        String appSecret = requireEnv("APP_SECRET");

        String openAiApiKey = requireEnv("OPENAI_API_KEY");
        String openAiModel = requireEnv("OPENAI_MODEL");
        String openAiBaseUrl = env("OPENAI_BASE_URL", "https://api.openai.com/v1");

        String larkDomain = env("LARK_DOMAIN", "https://open.feishu.cn");
        String mcpUrl = env("MCP_URL", "https://mcp.feishu.cn/mcp");
        String allowedTools = env("LARK_MCP_ALLOWED_TOOLS", "get-comments,fetch-doc");

        // Get Tenant Access Token
        // 获取 Tenant Access Token
        String tenantAccessToken = fetchTenantAccessToken(larkDomain, appId, appSecret);

        Map<String, String> mcpHeaders = Map.of(
                "X-Lark-MCP-Allowed-Tools", allowedTools,
                "X-Lark-MCP-TAT", tenantAccessToken
        );

        // Create MCP client with HTTP transport
        // 创建带有 HTTP 传输的 MCP 客户端
        McpTransport transport = new StreamableHttpMcpTransport.Builder()
                .url(mcpUrl)
                .customHeaders(mcpHeaders)
                .build();

        // Initialize MCP client
        // 初始化 MCP 客户端
        McpClient mcpClient = new DefaultMcpClient.Builder()
                .key("lark-mcp")
                .transport(transport)
                .build();

        // Create Tool Provider
        // 创建工具提供者
        ToolProvider toolProvider = McpToolProvider.builder()
                .mcpClients(List.of(mcpClient))
                .build();

        // Create OpenAI model
        // 创建 OpenAI 模型
        OpenAiChatModel model = OpenAiChatModel.builder()
                .baseUrl(openAiBaseUrl)
                .apiKey(openAiApiKey)
                .modelName(openAiModel)
                .timeout(Duration.ofSeconds(60))
                .customHeaders(Map.of(
                        "Authorization", "Bearer " + openAiApiKey,
                        "api-key", openAiApiKey,
                        "x-api-key", openAiApiKey
                ))
                .build();

        // Create Assistant with AI Services
        // 使用 AI Services 创建助手
        Assistant assistant = AiServices.builder(Assistant.class)
                .chatModel(model)
                .toolProvider(toolProvider)
                .systemMessageProvider(chatMemoryId -> "You are a feishu smart assistant, you are good at helping users solve problems, you can call various tools of feishu to help users complete tasks.")
                .build();

        // Invoke assistant
        // 调用助手
        String userPrompt = "Please read the feishu document of https://feishu.feishu.cn/docx/WtwHdAngzoEU9IxyfhtcYsHCnDe by app";
        System.out.println("🚀 调用 Agent | Invoking agent");
        String response = assistant.chat(userPrompt);
        System.out.println("✅ Agent 响应 | Agent response");
        System.out.println(response);

        mcpClient.close();
    }

    /**
     * Load .env file to System Properties
     * 加载 .env 文件到系统属性
     */
    private static void loadDotenvToSystemProperties() {
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMalformed()
                .ignoreIfMissing()
                .load();
        dotenv.entries().forEach(e -> System.setProperty(e.getKey(), e.getValue()));
    }

    /**
     * Get environment variable with default value
     * 获取环境变量（带默认值）
     */
    private static String env(String key, String defaultValue) {
        String v = System.getProperty(key);
        if (v != null && !v.isBlank()) {
            return v;
        }
        v = System.getenv(key);
        if (v != null && !v.isBlank()) {
            return v;
        }
        return defaultValue;
    }

    /**
     * Get required environment variable
     * 获取必需的环境变量
     */
    private static String requireEnv(String key) {
        String v = env(key, null);
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("Missing required env: " + key);
        }
        return v;
    }

    /**
     * Get Tenant Access Token from Lark/Feishu
     * 从飞书获取 Tenant Access Token
     */
    private static String fetchTenantAccessToken(String larkDomain, String appId, String appSecret) throws IOException {
        String url = larkDomain.replaceAll("/+$", "") + "/open-apis/auth/v3/tenant_access_token/internal";
        JsonNode body = OBJECT_MAPPER.createObjectNode()
                .put("app_id", appId)
                .put("app_secret", appSecret);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        HttpResponse<String> response;
        try {
            response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while fetching tenant_access_token", e);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Failed to fetch tenant_access_token, http=" + response.statusCode());
        }

        String raw = Objects.requireNonNull(response.body());
        JsonNode json = OBJECT_MAPPER.readTree(raw);
        int code = json.path("code").asInt(-1);
        if (code != 0) {
            throw new IOException("Failed to fetch tenant_access_token, code=" + code + ", msg=" + json.path("msg").asText());
        }
        String token = json.path("tenant_access_token").asText();
        if (token == null || token.isBlank()) {
            throw new IOException("tenant_access_token is empty");
        }
        return token;
    }
}
