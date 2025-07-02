/**
 * AI代理服务
 * AI Agent Service
 *
 * 功能说明:
 * - 管理AI模型的对话生成
 * - 处理工具调用和结果
 * - 实现流式响应更新
 * - 管理用户会话状态
 *
 * Features:
 * - Manage AI model conversation generation
 * - Handle tool calls and results
 * - Implement streaming response updates
 * - Manage user session state
 */

import { streamText } from 'ai';
import { config } from '../config';
import { ContextService } from './context';
import { ChatProvider, Message } from '../provider/type';
import { pThrottle } from '../util';
import { getSystemPrompt } from '../prompt';
import { AgentCoreMessage, parseChunk2Message } from '../util/message';

/**
 * AI代理服务类
 * AI Agent Service Class
 * 为每个用户提供独立的AI对话管理
 * Provides independent AI conversation management for each user
 */
export class AgentService {
  /**
   * 用户代理服务实例缓存
   * User agent service instance cache
   * 键为用户ID，值为对应的代理服务实例
   * Key is user ID, value is corresponding agent service instance
   */
  private static agentServices = new Map<string, AgentService>();

  /**
   * 获取用户专属的代理服务实例（单例模式）
   * Get user-specific agent service instance (singleton pattern)
   * @param userId 用户ID / User ID
   * @param provider 聊天提供者 / Chat provider
   * @returns 代理服务实例 / Agent service instance
   */
  static getUserAgentService(userId: string, provider: ChatProvider) {
    if (this.agentServices.has(userId)) {
      return this.agentServices.get(userId)!;
    }
    const agentService = new AgentService(userId, provider);
    this.agentServices.set(userId, agentService);
    return agentService;
  }

  /** 用户上下文服务实例 / User context service instance */
  private contextService: ContextService;

  /** 聊天提供者实例 / Chat provider instance */
  private provider: ChatProvider;

  /** 标记是否正在运行AI生成任务 / Flag indicating if AI generation task is running */
  private isRunning: boolean = false;

  /**
   * 构造函数
   * Constructor
   * @param userId 用户ID / User ID
   * @param provider 聊天提供者 / Chat provider
   */
  constructor(private readonly userId: string, provider: ChatProvider) {
    this.contextService = ContextService.getUserContextService(userId);
    this.provider = provider;
  }

  /**
   * 节流的消息更新函数
   * Throttled message update function
   * 限制更新频率为每200ms一次，防止过于频繁的API调用
   * Limit update frequency to once per 200ms to prevent excessive API calls
   */
  throttledUpdateMessage = pThrottle(async (messageId: string, message: Message): Promise<void> => {
    return await this.provider.updateMessage(messageId, message);
  }, 200);

  /**
   * 生成AI响应
   * Generate AI response
   * @param chatId 聊天ID / Chat ID
   * @param query 用户查询 / User query
   */
  async generateResponse(chatId: string, query: string) {
    // 获取用户上下文信息
    // Get user context information
    const userContext = await this.contextService.mustGetContext();

    // 检查是否有任务正在执行（防止并发执行）
    // Check if any task is currently running (prevent concurrent execution)
    if (this.isRunning) {
      this.provider.sendMessage(
        chatId,
        '不能同时执行多个任务，请稍后再试 / Cannot execute multiple tasks simultaneously, please try again later'
      );
      return;
    }

    // 将用户消息添加到上下文历史
    // Add user message to context history
    this.contextService.addMessage([{ role: 'user', content: query }]);

    this.isRunning = true;

    try {
      // 发送初始"思考中"消息并获取消息ID
      // Send initial "thinking" message and get message ID
      const { messageId } = await this.provider.sendMessage(chatId, '思考中... / Thinking...');

      // 临时消息数组，用于流式更新
      // Temporary message array for streaming updates
      let tempMessages: AgentCoreMessage[] = [];

      // 工具集合，从所有MCP客户端收集
      // Tool collection, gathered from all MCP clients
      let tools: Awaited<ReturnType<(typeof userContext.mcpClients)[number]['tools']>> = {};
      for (const mcpClient of userContext.mcpClients) {
        const mcpTools = await mcpClient.tools();
        tools = { ...tools, ...mcpTools };
      }

      for (const tool of Object.values(tools)) {
        const originExec = tool.execute;
        tool.execute = (async (...args) => {
          try {
            return await originExec(...args);
          } catch (error) {
            console.error(error);
            return error;
          }
        }) as typeof tool.execute;
      }

      console.log('处理用户请求 / Start handle User Query', query);
      // 开始流式文本生成
      // Start streaming text generation
      const stream = streamText({
        model: config.agent.model,

        // 系统提示词
        // System prompt
        system: getSystemPrompt(this.userId, chatId),

        // 对话历史消息
        // Conversation history messages
        messages: userContext.coreMessages,

        // 最大执行步数
        // Maximum execution steps
        maxSteps: config.agent.maxStep,
        tools,

        /**
         * 流式响应处理器
         * Streaming response handler
         * 在每个数据块到达时更新消息显示
         * Update message display when each data chunk arrives
         */
        onChunk: chunk => {
          tempMessages = parseChunk2Message(tempMessages, chunk);
          this.throttledUpdateMessage(messageId, tempMessages);
        },

        /**
         * 步骤完成处理器
         * Step completion handler
         * 在每个执行步骤完成时保存消息到上下文
         * Save messages to context when each execution step completes
         */
        onStepFinish: step => {
          const messages = step.response.messages;
          this.contextService.addMessage(messages);
          this.provider.updateMessage(messageId, messages);
        },

        /**
         * 错误处理器
         * Error handler
         * 处理生成过程中的异常情况
         * Handle exceptions during generation process
         */
        onError: e => {
          console.error(e);
          this.isRunning = false;
          this.provider.sendMessage(
            chatId,
            '发生错误，请重试 / An error occurred, please try again\n' + JSON.stringify(e, null, 2)
          );
        },

        /**
         * 完成处理器
         * Completion handler
         * 清理临时状态，重置运行标志
         * Clean up temporary state, reset running flag
         */
        onFinish: () => {
          this.isRunning = false;
          console.log('处理用户请求完成 / Handle User Query Done');
          tempMessages = [];
        },
      });

      // 等待流式处理完成
      // Wait for streaming process to complete
      await stream.consumeStream();
    } finally {
      this.isRunning = false;
    }
  }
}
