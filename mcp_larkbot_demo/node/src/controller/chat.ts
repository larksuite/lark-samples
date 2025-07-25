/**
 * 聊天控制器
 * Chat Controller
 *
 * 功能说明:
 * - 处理来自不同聊天提供者的消息
 * - 管理用户认证流程
 * - 协调代理服务和上下文服务
 * - 处理特殊命令（如清除上下文）
 *
 * Features:
 * - Handle messages from different chat providers
 * - Manage user authentication flow
 * - Coordinate agent service and context service
 * - Handle special commands (like clearing context)
 */

import { AgentService } from '../service/agent';
import { ContextService } from '../service/context';
import { ChatProvider } from '../provider/type';
import { Express } from 'express';

/**
 * 聊天控制器类
 * Chat Controller Class
 * 负责协调多个聊天提供者的消息处理逻辑
 * Responsible for coordinating message processing logic across multiple chat providers
 */
export class ChatController {
  /**
   * 构造函数
   * Constructor
   * @param providers 聊天 Provider 数组 / Array of chat providers
   */
  constructor(private readonly providers: ChatProvider[]) {}

  /**
   * 注册所有聊天提供者的事件监听器和路由
   * Register event listeners and routes for all chat providers
   * @param app Express应用实例 / Express application instance
   */
  register(app: Express) {
    for (const provider of this.providers) {
      /**
       * 注册消息接收事件处理器
       * Register message receive event handler
       * 当收到用户消息时触发
       * Triggered when receiving user messages
       */
      provider.registerMessageReceiveEvent(app, async (userId, chatId, query) => {
        const agentService = AgentService.getUserAgentService(userId, provider);
        const contextService = ContextService.getUserContextService(userId);

        /**
         * 处理清除上下文命令
         * Handle clear context command
         * 用户发送 /clear 命令时清除聊天历史
         * Clear chat history when user sends /clear command
         */
        if (query.startsWith('/clear')) {
          contextService.cleanMessage();
          await provider.sendMessage(chatId, '成功清除用户上下文 / Successfully cleared user context');
          return;
        }

        /**
         * 检查用户登录状态
         * Check user login status
         * 未登录用户需要先完成授权流程
         * Unauthorized users need to complete authorization flow first
         */
        if (!contextService.isLogin) {
          // 发送登录链接给用户
          // Send login link to user
          await provider.sendMessage(
            chatId,
            `请点击 ${provider.authorizeUrl} 登录 / Please click ${provider.authorizeUrl} to login`
          );

          // 等待用户完成登录（最多等待5分钟）
          // Wait for user to complete login (up to 5 minutes)
          const success = await contextService.waitLogin();
          if (!success) {
            await provider.sendMessage(chatId, '登录超时，请重试 / Login timeout, please try again');
            return;
          }
        }

        /**
         * 生成AI响应
         * Generate AI response
         * 用户已登录，开始处理消息并生成智能回复
         * User is logged in, start processing message and generate intelligent response
         */
        await agentService.generateResponse(chatId, query);
      });

      /**
       * 注册授权回调处理器
       * Register authorization callback handler
       * 处理用户完成OAuth授权后的回调
       * Handle callback after user completes OAuth authorization
       */
      provider.registerAuthCallback(app, async authInfo => {
        // 获取用户上下文服务并添加认证令牌
        // Get user context service and add auth token
        const contextService = ContextService.getUserContextService(authInfo.userId);
        contextService.addAuthToken(authInfo);
      });
    }
  }
}
