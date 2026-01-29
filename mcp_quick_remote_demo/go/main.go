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

var UserPrompt = `Please read the feishu document of https://feishu.feishu.cn/docx/WtwHdAngzoEU9IxyfhtcYsHCnDe by tenant_access_token`

var SystemPrompt = `You are a feishu smart assistant, you are good at helping users solve problems, you can call various tools of feishu to help users complete tasks.`

func main() {

	// Load environment variables from .env file for configuration
	// 从 .env 文件加载环境变量进行配置
	if err := godotenv.Load(); err != nil {
		fmt.Printf("警告: 无法加载.env文件 | Warning: Could not load .env file: %v\n", err)
		fmt.Println("提示: 请确保在项目根目录创建 .env 文件 | Tip: Please ensure .env file exists in project root")
	}

	ctx := context.Background()

	tat, err := getTAT(ctx)
	if err != nil {
		log.Fatal(err)
	}

	mcpTools := getMCPTool(ctx, tat)

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

	agent, err := react.NewAgent(ctx, &react.AgentConfig{
		Model:       chatModel,
		ToolsConfig: compose.ToolsNodeConfig{Tools: mcpTools},
	})

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

// https://www.cloudwego.io/docs/eino/ecosystem_integration/tool/tool_mcp/
func getMCPTool(ctx context.Context, tat string) []tool.BaseTool {
	mcpURL := getenvDefault("MCP_URL", "https://mcp.feishu.cn/mcp")
	allowedTools := getenvDefault("LARK_MCP_ALLOWED_TOOLS", "create-doc,fetch-doc")

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

	tools, err := mcpp.GetTools(ctx, &mcpp.Config{Cli: cli})
	if err != nil {
		log.Fatal(err)
	}

	return tools
}

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

type HeaderTransport struct {
	Transport http.RoundTripper
	Headers   map[string]string
}

func (t *HeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for k, v := range t.Headers {
		req.Header.Set(k, v)
	}
	if t.Transport == nil {
		return http.DefaultTransport.RoundTrip(req)
	}
	return t.Transport.RoundTrip(req)
}
