package app

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
)

// LLMApplication represents the main application structure that integrates LLM and MCP client
// LLMApplication 表示集成 LLM 和 MCP 客户端的主应用程序结构
type LLMApplication struct {
	mcpClient *client.Client // MCP client for tool communication / MCP 客户端用于工具通信
	llmClient LLMClient      // LLM client for language model interaction / LLM 客户端用于语言模型交互
}

// NewLLMApplication creates a new LLM application instance with initialized MCP and LLM clients
// NewLLMApplication 创建一个新的 LLM 应用程序实例，并初始化 MCP 和 LLM 客户端
func NewLLMApplication() (*LLMApplication, error) {

	// Create and initialize Lark MCP client / 创建并初始化 Lark MCP 客户端
	mcpClient, err := createLarkMCPClient()

	if err != nil {
		return nil, fmt.Errorf("创建Lark MCP客户端失败: %w", err)
	}

	return &LLMApplication{
		mcpClient: mcpClient,
		llmClient: NewLLMClient(),
	}, nil
}

// createLarkMCPClient creates and initializes a Lark MCP client with environment configuration
// createLarkMCPClient 创建并初始化带有环境配置的 Lark MCP 客户端
func createLarkMCPClient() (*client.Client, error) {
	// Get app credentials from environment variables / 从环境变量获取应用凭证
	appId := os.Getenv("APP_ID")
	appSecret := os.Getenv("APP_SECRET")
	larkDomain := os.Getenv("LARK_DOMAIN")

	if appId == "" || appSecret == "" {
		log.Println("警告: APP_ID 或 APP_SECRET 未设置，将使用默认的MCP服务器配置")
		log.Println("Warning: APP_ID or APP_SECRET not set, using default MCP server configuration")
	}

	// Create MCP client using stdio transport with Lark MCP server
	// 使用标准输入输出传输协议创建 MCP 客户端并连接到 Lark MCP 服务器
	mcpClient, err := client.NewStdioMCPClient(
		"npx",
		[]string{},
		"-y", "@larksuiteoapi/lark-mcp", "mcp", "-a", appId, "-s", appSecret, "-d", larkDomain, "--token-mode", "tenant_access_token",
	)

	if err != nil {
		return nil, err
	}

	// Start and initialize the MCP client / 启动并初始化 MCP 客户端
	ctx := context.Background()
	err = mcpClient.Start(ctx)
	if err != nil {
		return nil, fmt.Errorf("启动Lark MCP客户端失败: %w", err)
	}
	_, err = mcpClient.Initialize(ctx, mcp.InitializeRequest{})
	if err != nil {
		return nil, fmt.Errorf("初始化Lark MCP客户端失败: %w", err)
	}

	return mcpClient, nil
}

// ProcessUserQuery processes user queries through LLM with MCP tool integration
// ProcessUserQuery 通过集成 MCP 工具的 LLM 处理用户查询
func (app *LLMApplication) ProcessUserQuery(ctx context.Context, query string) error {

	// Get available tools from MCP server / 从 MCP 服务器获取可用工具
	tools, err := app.mcpClient.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		return fmt.Errorf("获取工具列表失败: %w", err)
	}

	// Start the conversation with user query / 使用用户查询开始对话
	app.llmClient.Chat(ctx, query)

	// Process conversation with up to 10 iterations for tool calls
	// 处理对话，最多进行 10 次迭代以处理工具调用
	for index := range 10 {
		log.Printf("🤖(%d) LLM 处理中... / LLM processing...", index)

		// Get LLM response and potential tool calls / 获取 LLM 响应和潜在的工具调用
		response, toolCalls, err := app.llmClient.Continue(ctx, tools.Tools)
		if err != nil {
			return fmt.Errorf("LLM调用失败: %w", err)
		}

		log.Printf("🤖(%d) 响应 / Response: %s", index, response)

		// If no tool calls needed, conversation is complete / 如果不需要工具调用，对话完成
		if len(toolCalls) == 0 {
			return nil
		}

		// Execute each tool call and feed results back to LLM
		// 执行每个工具调用并将结果反馈给 LLM
		for _, toolCall := range toolCalls {
			log.Printf("🔧 执行工具调用 / Executing tool call: %s", toolCall.Name)

			// Call the MCP tool / 调用 MCP 工具
			result, err := app.mcpClient.CallTool(ctx, mcp.CallToolRequest{
				Params: mcp.CallToolParams{
					Name:      toolCall.Name,
					Arguments: toolCall.Arguments,
				},
			})
			if err != nil {
				log.Printf("❌ 工具调用失败 / Tool call failed: %v", err)
				return fmt.Errorf("工具调用失败: %w", err)
			}

			// Feed tool result back to LLM / 将工具结果反馈给 LLM
			app.llmClient.ChatWithToolResult(ctx, toolCall.ID, result)
			log.Printf("✅ 工具 / Tool %s 执行完成 / execution completed", toolCall.Name)
		}

	}

	return nil
}
