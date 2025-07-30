/**
 * 聊天提供者类型定义
 * Chat Provider Type Definitions
 *
 * 功能说明:
 * - 定义聊天提供者的通用接口
 * - 定义认证信息结构
 * - 定义消息类型
 *
 * Features:
 * - Define common interface for chat providers
 * - Define authentication information structure
 * - Define message types
 */

import { CoreAssistantMessage, CoreToolMessage } from 'ai';
import { Express } from 'express';

/**
 * 用户认证信息接口
 * User Authentication Information Interface
 * 存储用户的OAuth认证相关信息
 * Stores user's OAuth authentication related information
 */
export interface AuthInfo {
  /** 用户唯一标识符 / User unique identifier */
  userId: string;

  /** 访问令牌，用于调用API / Access token for API calls */
  accessToken: string;

  /** 刷新令牌，用于更新访问令牌 / Refresh token for updating access token */
  refreshToken: string;

  /** 令牌过期时间戳 / Token expiration timestamp */
  expiresAt: number;
}

/**
 * 消息类型定义
 * Message Type Definition
 * 支持纯文本消息或AI核心消息数组
 * Supports plain text messages or AI core message arrays
 */
export type Message = string | (CoreAssistantMessage | CoreToolMessage)[];

/**
 * 聊天提供者接口
 * Chat Provider Interface
 * 定义所有聊天提供者必须实现的方法
 * Defines methods that all chat providers must implement
 */
export interface ChatProvider {
  /**
   * 获取授权URL
   * Get authorization URL
   * 用于用户进行OAuth授权登录
   * Used for user OAuth authorization login
   */
  authorizeUrl: string;

  /**
   * 发送消息到指定聊天
   * Send message to specified chat
   * @param chatId 聊天ID / Chat ID
   * @param message 要发送的消息 / Message to send
   * @returns 返回消息ID / Returns message ID
   */
  sendMessage(chatId: string, message: Message): Promise<{ messageId: string }>;

  /**
   * 更新已发送的消息
   * Update sent message
   * @param messageId 消息ID / Message ID
   * @param message 新的消息内容 / New message content
   */
  updateMessage(messageId: string, message: Message): Promise<void>;

  /**
   * 注册消息接收事件监听器
   * Register message receive event listener
   * @param app Express应用实例 / Express application instance
   * @param onMessage 消息处理回调函数 / Message processing callback function
   */
  registerMessageReceiveEvent(
    app: Express,
    onMessage: (userId: string, chatId: string, query: string) => Promise<void>
  ): void;

  /**
   * 注册认证回调处理器
   * Register authentication callback handler
   * @param app Express应用实例 / Express application instance
   * @param onAuth 认证完成回调函数 / Authentication completion callback function
   */
  registerAuthCallback(app: Express, onAuth: (authInfo: AuthInfo) => Promise<void>): void;
}
