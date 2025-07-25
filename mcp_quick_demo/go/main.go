// main.go - MCP Go Demo Entry Point
// main.go - MCP Go 演示入口点

// If you need more information about mcp-go, please refer to https://mcp-go.dev/clients
// 如果你需要更多关于 mcp-go 的信息，请参考 https://mcp-go.dev/clients

package main

import (
	"context"
	"fmt"
	"log"
	"mcp-quick-demo/app"
	"mcp-quick-demo/prompt"
	"os"

	"github.com/joho/godotenv"
)

// main function initializes the MCP demo application and processes user queries
// main 函数初始化 MCP 演示应用程序并处理用户查询
func main() {
	// Load environment variables from .env file for configuration
	// 从 .env 文件加载环境变量进行配置
	if err := godotenv.Load(); err != nil {
		fmt.Printf("警告: 无法加载.env文件 | Warning: Could not load .env file: %v\n", err)
		fmt.Println("提示: 请确保在项目根目录创建 .env 文件 | Tip: Please ensure .env file exists in project root")
	}

	// Validate required environment variables for OpenAI API access
	// 验证 OpenAI API 访问所需的环境变量
	requiredEnvs := []string{"OPENAI_API_KEY", "OPENAI_MODEL"}
	for _, env := range requiredEnvs {
		if os.Getenv(env) == "" {
			log.Fatalf("❌ 必需的环境变量 %s 未设置 | Required environment variable %s is not set", env, env)
		}
	}

	// Print configuration status for debugging
	// 打印配置状态用于调试
	fmt.Printf("🔧 使用模型 | Using model: %s\n", os.Getenv("OPENAI_MODEL"))
	if baseURL := os.Getenv("OPENAI_BASE_URL"); baseURL != "" {
		fmt.Printf("🌐 API 基础 URL | API Base URL: %s\n", baseURL)
	}

	// Create LLM Application instance with MCP integration
	// 创建集成 MCP 的 LLM 应用程序实例
	app, err := app.NewLLMApplication()
	if err != nil {
		log.Fatalf("❌ 创建应用失败 | Failed to create application: %v", err)
	}

	fmt.Printf("🤖 处理查询 | Processing query: %s\n\n", prompt.UserPrompt)

	// Process user query through the MCP-enabled AI agent
	// 通过启用 MCP 的 AI Agent处理用户查询
	ctx := context.Background()
	err = app.ProcessUserQuery(ctx, prompt.UserPrompt)
	if err != nil {
		log.Fatalf("❌ 处理查询失败 | Failed to process query: %v", err)
	}

	fmt.Printf("✅ 应用程序执行完成 | Application execution completed successfully\n")
}
