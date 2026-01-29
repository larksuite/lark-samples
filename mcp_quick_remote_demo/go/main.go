// References | 参考
// MCP Go Client: https://mcp-go.dev/clients
// Lark OpenAPI MCP: https://github.com/larksuite/lark-openapi-mcp

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
	"github.com/joho/godotenv"
	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcore "github.com/larksuite/oapi-sdk-go/v3/core"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"

	"github.com/cloudwego/eino-ext/components/model/openai"
	mcpp "github.com/cloudwego/eino-ext/components/tool/mcp"
)

// UserPrompt is the default user prompt | UserPrompt 是默认的用户提示词
var UserPrompt = `Please read the feishu document of https://feishu.feishu.cn/docx/WtwHdAngzoEU9IxyfhtcYsHCnDe by tenant_access_token`

// SystemPrompt is the default system prompt | SystemPrompt 是默认的系统提示词
var SystemPrompt = `You are a feishu smart assistant, you are good at helping users solve problems, you can call various tools of feishu to help users complete tasks.`

func main() {

	// Load environment variables from .env file for configuration
	// 从 .env 文件加载环境变量进行配置
	if err := godotenv.Load(); err != nil {
		fmt.Printf("警告: 无法加载.env文件 | Warning: Could not load .env file: %v\n", err)
		fmt.Println("提示: 请确保在项目根目录创建 .env 文件 | Tip: Please ensure .env file exists in project root")
	}

	ctx := context.Background()

	// Get Tenant Access Token
	// 获取 Tenant Access Token
	tat, err := getTAT(ctx)
	if err != nil {
		log.Fatal(err)
	}

	// Get MCP tools from remote server
	// 从远程服务器获取 MCP 工具
	mcpTools := getMCPTool(ctx, tat)

	// Create and configure ChatModel
	// 创建并配置 ChatModel
	chatModel, err := openai.NewChatModel(context.Background(), &openai.ChatModelConfig{
		Model:   os.Getenv("OPENAI_MODEL"),
		APIKey:  os.Getenv("OPENAI_API_KEY"),
		BaseURL: os.Getenv("OPENAI_BASE_URL"),
		HTTPClient: &http.Client{
			Transport: &HeaderTransport{
				Headers: map[string]string{
					"api-key": os.Getenv("OPENAI_API_KEY"),
				},
			},
		},
	})

	if err != nil {
		log.Fatal(err)
	}

	// Create Agent with tools
	// 使用工具创建 Agent
	agent, err := react.NewAgent(ctx, &react.AgentConfig{
		Model:       chatModel,
		ToolsConfig: compose.ToolsNodeConfig{Tools: mcpTools},
	})

	// Generate response
	// 生成响应
	resp, err := agent.Generate(ctx, []*schema.Message{schema.SystemMessage(SystemPrompt), schema.UserMessage(UserPrompt)})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(resp.Content)

}

func getenvDefault(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

// getMCPTool connects to the MCP server and retrieves tools
// getMCPTool 连接到 MCP 服务器并获取工具
// https://www.cloudwego.io/docs/eino/ecosystem_integration/tool/tool_mcp/
func getMCPTool(ctx context.Context, tat string) []tool.BaseTool {
	mcpURL := getenvDefault("MCP_URL", "https://mcp.feishu.cn/mcp")
	allowedTools := getenvDefault("LARK_MCP_ALLOWED_TOOLS", "get-comments,fetch-doc")

	// Create MCP client with HTTP transport
	// 创建带有 HTTP 传输的 MCP 客户端
	cli, err := client.NewStreamableHttpClient(mcpURL, transport.WithHTTPHeaders(map[string]string{
		"X-Lark-MCP-Allowed-Tools": allowedTools,
		"X-Lark-MCP-TAT":           tat,
	}))
	if err != nil {
		log.Fatal(err)
	}
	err = cli.Start(ctx)
	if err != nil {
		log.Fatal(err)
	}

	// Initialize MCP client
	// 初始化 MCP 客户端
	initRequest := mcp.InitializeRequest{}
	initRequest.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	initRequest.Params.ClientInfo = mcp.Implementation{
		Name:    "example-client",
		Version: "1.0.0",
	}

	_, err = cli.Initialize(ctx, initRequest)
	if err != nil {
		log.Fatal(err)
	}

	// Get tools from MCP client
	// 从 MCP 客户端获取工具
	tools, err := mcpp.GetTools(ctx, &mcpp.Config{Cli: cli})
	if err != nil {
		log.Fatal(err)
	}

	return tools
}

// getTAT retrieves the Tenant Access Token from Lark/Feishu
// getTAT 从飞书获取 Tenant Access Token
func getTAT(ctx context.Context) (string, error) {
	appID := os.Getenv("APP_ID")
	appSecret := os.Getenv("APP_SECRET")

	client := lark.NewClient(appID, appSecret)

	req := &larkcore.SelfBuiltTenantAccessTokenReq{
		AppID:     appID,
		AppSecret: appSecret,
	}

	resp, err := client.GetTenantAccessTokenBySelfBuiltApp(ctx, req)
	if err != nil {
		return "", err
	}

	if !resp.Success() {
		return "", fmt.Errorf("failed to get TAT: %s", resp.Msg)
	}

	return resp.TenantAccessToken, nil
}

// HeaderTransport adds custom headers to HTTP requests
// HeaderTransport 向 HTTP 请求添加自定义标头
type HeaderTransport struct {
	Transport http.RoundTripper
	Headers   map[string]string
}

// RoundTrip executes a single HTTP transaction
// RoundTrip 执行单个 HTTP 事务
func (t *HeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for k, v := range t.Headers {
		req.Header.Set(k, v)
	}
	if t.Transport == nil {
		return http.DefaultTransport.RoundTrip(req)
	}
	return t.Transport.RoundTrip(req)
}
