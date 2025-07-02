package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mcp-quick-demo/prompt"
	"net/http"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/sashabaranov/go-openai"
)

// customHeaderTransport is a custom HTTP Transport for adding custom headers to requests
// customHeaderTransport 是一个自定义的 HTTP Transport，用于为请求添加自定义头部
type customHeaderTransport struct {
	Transport http.RoundTripper // Base transport / 基础传输层
	Headers   map[string]string // Custom headers to add / 要添加的自定义头部
}

// RoundTrip implements the http.RoundTripper interface to add custom headers
// RoundTrip 实现 http.RoundTripper 接口以添加自定义头部
func (t *customHeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Add custom headers to each request / 为每个请求添加自定义头部
	for key, value := range t.Headers {
		req.Header.Set(key, value)
	}
	return t.Transport.RoundTrip(req)
}

// ToolCall represents a tool function call request from the LLM
// ToolCall 表示来自 LLM 的工具函数调用请求
type ToolCall struct {
	ID        string                 `json:"id"`        // Unique identifier for the tool call / 工具调用的唯一标识符
	Name      string                 `json:"name"`      // Name of the tool to call / 要调用的工具名称
	Arguments map[string]interface{} `json:"arguments"` // Arguments to pass to the tool / 传递给工具的参数
}

// LLMClient defines the interface for interacting with Large Language Models
// LLMClient 定义与大语言模型交互的接口
type LLMClient interface {
	// Chat starts a conversation with the given user query
	// Chat 使用给定的用户查询开始对话
	Chat(ctx context.Context, query string)

	// ChatWithToolResult continues the conversation with tool execution results
	// ChatWithToolResult 使用工具执行结果继续对话
	ChatWithToolResult(ctx context.Context, toolCallID string, toolResult *mcp.CallToolResult) (response string, err error)

	// Continue processes the conversation and returns response with potential tool calls
	// Continue 处理对话并返回响应以及潜在的工具调用
	Continue(ctx context.Context, availableTools []mcp.Tool) (response string, toolCalls []ToolCall, err error)
}

// OpenAILLMClient is an implementation of LLMClient using OpenAI's API
// OpenAILLMClient 是使用 OpenAI API 的 LLMClient 实现
type OpenAILLMClient struct {
	client       *openai.Client                 // OpenAI API client / OpenAI API 客户端
	model        string                         // Model name to use / 要使用的模型名称
	conversation []openai.ChatCompletionMessage // Conversation history / 对话历史
}

// NewLLMClient creates a new OpenAI LLM client with environment configuration
// NewLLMClient 创建一个新的使用环境配置的 OpenAI LLM 客户端
func NewLLMClient() LLMClient {
	// Get API key from environment variable / 从环境变量获取 API 密钥
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY 环境变量未设置 / OPENAI_API_KEY environment variable not set")
	}

	// Get model name from environment variable / 从环境变量获取模型名称
	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		log.Fatal("OPENAI_MODEL 环境变量未设置 / OPENAI_MODEL environment variable not set")
	}

	// Create OpenAI client configuration / 创建 OpenAI 客户端配置
	config := openai.DefaultConfig(apiKey)

	// Set custom base URL if provided / 如果提供了自定义基础 URL 则设置
	if baseURL := os.Getenv("OPENAI_BASE_URL"); baseURL != "" {
		config.BaseURL = baseURL
	}

	// Create custom HTTP client with additional headers for compatibility
	// 创建带有额外头部的自定义 HTTP 客户端以确保兼容性
	customClient := &http.Client{
		Transport: &customHeaderTransport{
			Transport: http.DefaultTransport,
			Headers: map[string]string{
				"Authorization": "Bearer " + apiKey,
				"x-api-key":     apiKey,
				"Api-Key":       apiKey,
			},
		},
	}

	config.HTTPClient = customClient

	return &OpenAILLMClient{
		client: openai.NewClientWithConfig(config),
		model:  model,
		// Initialize conversation with system prompt / 使用系统提示初始化对话
		conversation: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: prompt.SystemPrompt,
			},
		},
	}
}

// convertMCPToolsToOpenAI converts MCP tool definitions to OpenAI tool format
// convertMCPToolsToOpenAI 将 MCP 工具定义转换为 OpenAI 工具格式
func (c *OpenAILLMClient) convertMCPToolsToOpenAI(mcpTools []mcp.Tool) []openai.Tool {
	var openaiTools []openai.Tool

	for _, tool := range mcpTools {
		// Convert tool input schema to OpenAI parameters format
		// 将工具输入架构转换为 OpenAI 参数格式
		parametersJSON, _ := json.Marshal(tool.InputSchema)
		var parameters map[string]interface{}
		json.Unmarshal(parametersJSON, &parameters)

		openaiTool := openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  parameters,
			},
		}
		openaiTools = append(openaiTools, openaiTool)
	}

	return openaiTools
}

// Continue processes the conversation and handles tool calls if needed
// Continue 处理对话并在需要时处理工具调用
func (c *OpenAILLMClient) Continue(ctx context.Context, availableTools []mcp.Tool) (string, []ToolCall, error) {
	// Convert MCP tools to OpenAI format / 将 MCP 工具转换为 OpenAI 格式
	openaiTools := c.convertMCPToolsToOpenAI(availableTools)

	// Prepare chat completion request / 准备聊天完成请求
	req := openai.ChatCompletionRequest{
		Model:    c.model,
		Messages: c.conversation,
		Tools:    openaiTools,
	}

	// Call OpenAI API / 调用 OpenAI API
	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", nil, fmt.Errorf("OpenAI API调用失败 / OpenAI API call failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", nil, fmt.Errorf("OpenAI返回空响应 / OpenAI returned empty response")
	}

	choice := resp.Choices[0]
	message := choice.Message

	// Add assistant's response to conversation history / 将助手的响应添加到对话历史
	c.conversation = append(c.conversation, message)

	var toolCalls []ToolCall
	// Process tool calls if present / 如果存在工具调用则处理
	if len(message.ToolCalls) > 0 {
		for _, tc := range message.ToolCalls {
			// Parse tool call arguments / 解析工具调用参数
			var args map[string]interface{}
			if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
				return "", nil, fmt.Errorf("解析工具调用参数失败 / Failed to parse tool call arguments: %w", err)
			}

			toolCall := ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: args,
			}
			toolCalls = append(toolCalls, toolCall)
		}
	}

	// Prepare response content / 准备响应内容
	responseContent := message.Content
	if responseContent == "" && len(toolCalls) > 0 {
		responseContent = "我需要调用工具来处理您的请求。/ I need to call tools to process your request."
	}

	return responseContent, toolCalls, nil
}

// Chat adds a user message to the conversation history
// Chat 将用户消息添加到对话历史中
func (c *OpenAILLMClient) Chat(ctx context.Context, query string) {
	// Add user message to conversation history / 添加用户消息到对话历史
	userMessage := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: query,
	}
	c.conversation = append(c.conversation, userMessage)
}

// ChatWithToolResult adds tool execution results to the conversation and returns the result content
// ChatWithToolResult 将工具执行结果添加到对话中并返回结果内容
func (c *OpenAILLMClient) ChatWithToolResult(ctx context.Context, toolCallID string, toolResult *mcp.CallToolResult) (string, error) {
	var resultContent string

	// Extract text content from tool result / 从工具结果中提取文本内容
	if len(toolResult.Content) > 0 {
		var contentParts []string
		for _, content := range toolResult.Content {
			if textContent, ok := mcp.AsTextContent(content); ok {
				contentParts = append(contentParts, textContent.Text)
			}
		}
		if len(contentParts) > 0 {
			resultContent = strings.Join(contentParts, "\n")
		} else {
			resultContent = "工具调用完成，但没有返回文本内容。/ Tool call completed but returned no text content."
		}
	} else {
		resultContent = "工具调用完成，但没有返回具体内容。/ Tool call completed but returned no specific content."
	}

	// Add tool result message to conversation history / 将工具结果消息添加到对话历史
	toolMessage := openai.ChatCompletionMessage{
		Role:       openai.ChatMessageRoleTool,
		Content:    resultContent,
		ToolCallID: toolCallID,
	}
	log.Printf("🔧 工具调用结果 / Tool call result: %+v", toolMessage)
	c.conversation = append(c.conversation, toolMessage)

	return resultContent, nil
}
