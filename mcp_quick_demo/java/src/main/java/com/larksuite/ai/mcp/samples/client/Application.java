/**
 * Application - Spring Boot application for MCP client with Lark integration demo
 * Application - 用于 MCP 客户端与飞书/Lark集成演示的 Spring Boot 应用程序
 * 
 * If you need more information about spring-ai, please refer to https://docs.spring.io/spring-ai/reference/api/mcp/mcp-client-boot-starter-docs.html
 * 如果你需要更多关于 spring-ai 的信息，请参考 https://docs.spring.io/spring-ai/reference/api/mcp/mcp-client-boot-starter-docs.html
 */
package com.larksuite.ai.mcp.samples.client;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;

/**
 * Main Spring Boot application class for MCP client demonstration
 * 用于 MCP 客户端演示的主 Spring Boot 应用程序类
 */
@SpringBootApplication
public class Application {

	// Static block to load environment variables from .env file before application starts
	// 静态块在应用程序启动前从 .env 文件加载环境变量
	static {
		try {
			// Configure dotenv to load environment variables from .env file
			// 配置 dotenv 从 .env 文件加载环境变量
			Dotenv dotenv = Dotenv.configure()
					.ignoreIfMalformed()  // Ignore malformed entries | 忽略格式错误的条目
					.ignoreIfMissing()    // Ignore if .env file is missing | 如果 .env 文件缺失则忽略
					.load();              // Load the configuration | 加载配置
			
			// Set each environment variable as system property
			// 将每个环境变量设置为系统属性
			dotenv.entries().forEach(entry -> {
				String key = entry.getKey();     // Environment variable name | 环境变量名
				String value = entry.getValue(); // Environment variable value | 环境变量值
				System.setProperty(key, value);  // Set as system property | 设置为系统属性
			});
			
			// Log successful loading of environment variables
			// 记录环境变量加载成功
			System.out.println("✅ 成功加载 .env 文件，包含 " + dotenv.entries().size() + " 个条目 | Successfully loaded .env file with " + dotenv.entries().size() + " entries");
			
			// Set active profile based on OS for MCP client configuration
			// 根据操作系统设置活动配置文件以适配 MCP 客户端配置
			String osName = System.getProperty("os.name").toLowerCase();
			if (osName.contains("win")) {
				System.setProperty("spring.profiles.active", "windows");
			} else {
				System.setProperty("spring.profiles.active", "default");
			}
		} catch (Exception e) {
			// Log warning if .env file cannot be loaded
			// 如果无法加载 .env 文件则记录警告
			System.out.println("⚠️ 警告：无法加载 .env 文件 | Warning: Could not load .env file - " + e.getMessage());
		}
	}

	/**
	 * Main method to start the Spring Boot application
	 * 启动 Spring Boot 应用程序的主方法
	 * 
	 * @param args Command line arguments | 命令行参数
	 */
	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	// Inject user input from application properties
	// 从应用程序属性中注入用户输入
	@Value("${ai.user.input}")
	private String userInput;  // User query to be processed | 要处理的用户查询

	/**
	 * Creates a CommandLineRunner bean to execute AI chat functionality
	 * 创建 CommandLineRunner bean 来执行 AI 聊天功能
	 * 
	 * @param chatClientBuilder Builder for creating ChatClient instance | 用于创建 ChatClient 实例的构建器
	 * @param tools Tool callback provider for MCP integration | 用于 MCP 集成的工具回调提供器
	 * @param context Application context for shutdown control | 用于关闭控制的应用程序上下文
	 * @return CommandLineRunner instance | CommandLineRunner 实例
	 */
	@Bean
	public CommandLineRunner predefinedQuestions(ChatClient.Builder chatClientBuilder, ToolCallbackProvider tools,
			ConfigurableApplicationContext context) {

		return args -> {

			// Build ChatClient with default tool callbacks for MCP integration
			// 使用默认工具回调构建 ChatClient 以进行 MCP 集成
			var chatClient = chatClientBuilder
					.defaultToolCallbacks(tools)  // Enable MCP tools | 启用 MCP 工具
					.build();

			// Display user question and get AI response
			// 显示用户问题并获取 AI 响应
			System.out.println("\n>>> 问题 | QUESTION: " + userInput);
			System.out.println("\n>>> 助手 | ASSISTANT: " + chatClient.prompt(userInput).call().content());

			context.close();
		};
	}
}