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

public class Application {

    interface Assistant {
        String chat(String message);
    }

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public static void main(String[] args) throws Exception {
        loadDotenvToSystemProperties();

        String appId = requireEnv("APP_ID");
        String appSecret = requireEnv("APP_SECRET");

        String openAiApiKey = requireEnv("OPENAI_API_KEY");
        String openAiModel = requireEnv("OPENAI_MODEL");
        String openAiBaseUrl = env("OPENAI_BASE_URL", "https://api.openai.com/v1");

        String larkDomain = env("LARK_DOMAIN", "https://open.feishu.cn");
        String mcpUrl = env("MCP_URL", "https://mcp.feishu.cn/mcp");
        String allowedTools = env("LARK_MCP_ALLOWED_TOOLS", "create-doc,fetch-doc");

        String tenantAccessToken = fetchTenantAccessToken(larkDomain, appId, appSecret);

        Map<String, String> mcpHeaders = Map.of(
                "X-Lark-MCP-Allowed-Tools", allowedTools,
                "X-Lark-MCP-TAT", tenantAccessToken
        );

        McpTransport transport = new StreamableHttpMcpTransport.Builder()
                .url(mcpUrl)
                .customHeaders(mcpHeaders)
                .build();

        McpClient mcpClient = new DefaultMcpClient.Builder()
                .key("lark-mcp")
                .transport(transport)
                .build();

        ToolProvider toolProvider = McpToolProvider.builder()
                .mcpClients(List.of(mcpClient))
                .build();

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

        Assistant assistant = AiServices.builder(Assistant.class)
                .chatModel(model)
                .toolProvider(toolProvider)
                .systemMessageProvider(chatMemoryId -> "You are a feishu smart assistant, you are good at helping users solve problems, you can call various tools of feishu to help users complete tasks.")
                .build();

        String userPrompt = "Please read the feishu document of https://feishu.feishu.cn/docx/WtwHdAngzoEU9IxyfhtcYsHCnDe by app";
        String response = assistant.chat(userPrompt);
        System.out.println(response);

        mcpClient.close();
    }

    private static void loadDotenvToSystemProperties() {
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMalformed()
                .ignoreIfMissing()
                .load();
        dotenv.entries().forEach(e -> System.setProperty(e.getKey(), e.getValue()));
    }

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

    private static String requireEnv(String key) {
        String v = env(key, null);
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("Missing required env: " + key);
        }
        return v;
    }

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
