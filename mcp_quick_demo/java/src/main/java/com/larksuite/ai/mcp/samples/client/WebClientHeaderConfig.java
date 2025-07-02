/**
 * WebClientHeaderConfig - Configuration class for customizing HTTP client headers
 * WebClientHeaderConfig - 用于自定义 HTTP 客户端头部的配置类
 */
package com.larksuite.ai.mcp.samples.client;

import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;

/**
 * Spring configuration class for customizing REST client headers for AI service compatibility
 * 用于自定义 REST 客户端头部以兼容 AI 服务的 Spring 配置类
 */
@Configuration
public class WebClientHeaderConfig {

    /**
     * Creates a REST client customizer bean to configure OpenAI API client
     * 创建 REST 客户端自定义器 bean 来配置 OpenAI API 客户端
     * 
     * @return RestClientCustomizer instance for OpenAI configuration | 用于 OpenAI 配置的 RestClientCustomizer 实例
     */
    @Bean
    public RestClientCustomizer openAiRestClientCustomizer() {
        return restClientBuilder -> {
            // Add API key interceptor to the REST client builder
            // 向 REST 客户端构建器添加 API 密钥拦截器
            restClientBuilder.requestInterceptor(apiKeyInterceptor());
        };
    }
    
    /**
     * Creates an HTTP request interceptor to add API key headers for different AI service providers
     * 创建 HTTP 请求拦截器来为不同的 AI 服务提供商添加 API 密钥头部
     * 
     * @return ClientHttpRequestInterceptor for API key header injection | 用于 API 密钥头部注入的 ClientHttpRequestInterceptor
     */
    @Bean
    public ClientHttpRequestInterceptor apiKeyInterceptor() {
        return (request, body, execution) -> {
            // Get API key from system properties (loaded from .env file)
            // 从系统属性获取 API 密钥（从 .env 文件加载）
            String apiKey = System.getProperty("OPENAI_API_KEY");
            
            // Validate API key availability
            // 验证 API 密钥可用性
            if (apiKey == null || apiKey.isEmpty()) {
                System.err.println("⚠️ 警告：OPENAI_API_KEY 未设置！| Warning: OPENAI_API_KEY is not set!");
            } else {
                // Add API key headers for compatibility with different AI service providers
                // 添加 API 密钥头部以兼容不同的 AI 服务提供商
                request.getHeaders().set("Authorization", "Bearer " + apiKey);  // Standard OpenAI format | 标准 OpenAI 格式
                request.getHeaders().set("api-key", apiKey);                    // Azure OpenAI format | Azure OpenAI 格式
                request.getHeaders().set("x-api-key", apiKey);                  // Alternative format for other providers | 其他提供商的替代格式
            }
            
            // Continue with the request execution
            // 继续执行请求
            return execution.execute(request, body);
        };
    }
}