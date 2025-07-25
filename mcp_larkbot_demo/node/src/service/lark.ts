/**
 * 飞书/LarkAPI服务
 * Lark API Service
 *
 * 功能说明:
 * - 封装飞书/Lark开放平台API调用
 * - 处理OAuth认证流程
 * - 提供消息发送和更新功能
 * - 管理WebSocket连接
 *
 * Features:
 * - Encapsulate Lark Open Platform API calls
 * - Handle OAuth authentication flow
 * - Provide message sending and updating functionality
 * - Manage WebSocket connections
 */

import { Client, WSClient, withUserAccessToken } from '@larksuiteoapi/node-sdk';
import { config } from '../config';

/**
 * OAuth令牌响应接口
 * OAuth Token Response Interface
 * 定义飞书/LarkOAuth认证返回的数据结构
 * Defines the data structure returned by Lark OAuth authentication
 */
export interface TokenResponse {
  /** 响应代码 / Response code */
  code: string;

  /** 访问令牌 / Access token */
  access_token: string;

  /** 访问令牌过期时间（秒）/ Access token expiration time (seconds) */
  expires_in: number;

  /** 刷新令牌 / Refresh token */
  refresh_token: string;

  /** 刷新令牌过期时间（秒）/ Refresh token expiration time (seconds) */
  refresh_token_expires_in: number;

  /** 授权范围 / Authorization scope */
  scope: string;

  /** 令牌类型 / Token type */
  token_type: string;
}

/**
 * 飞书/Lark服务类
 * Lark Service Class
 * 提供与飞书/Lark开放平台交互的所有功能
 * Provides all functionality for interacting with Lark Open Platform
 */
export class LarkService {
  /** 飞书/LarkHTTP客户端实例 / Lark HTTP client instance */
  larkClient = new Client({ appId: config.lark.appId, appSecret: config.lark.appSecret, domain: config.lark.domain });

  /** 飞书/LarkWebSocket客户端实例 / Lark WebSocket client instance */
  larkWsClient = new WSClient({
    appId: config.lark.appId,
    appSecret: config.lark.appSecret,
    domain: config.lark.domain,
  });

  /**
   * 获取OAuth回调URL
   * Get OAuth callback URL
   * @returns 完整的回调URL / Complete callback URL
   */
  get callbackUrl() {
    return `http://localhost:${config.port}${config.lark.callbackPath}`;
  }

  /**
   * 获取OAuth授权URL
   * Get OAuth authorization URL
   * @returns 用户授权登录的URL / URL for user authorization login
   */
  get authorizeUrl() {
    const endpoint = new URL(`${config.lark.domain}/open-apis/authen/v1/authorize`);
    endpoint.searchParams.append('client_id', config.lark.appId);
    endpoint.searchParams.append('redirect_uri', this.callbackUrl);
    if (config.lark.scope.length > 0) {
      endpoint.searchParams.append('scope', config.lark.scope.join(' '));
    }
    return endpoint.toString();
  }

  /**
   * 使用授权码获取用户访问令牌
   * Get user access token using authorization code
   * @param code OAuth授权码 / OAuth authorization code
   * @returns Promise<TokenResponse> 令牌响应 / Token response
   */
  async getUserAccessToken(code: string): Promise<TokenResponse> {
    const res = await fetch(`${config.lark.domain}/open-apis/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.lark.appId,
        client_secret: config.lark.appSecret,
        code,
        redirect_uri: this.callbackUrl,
      }),
    });
    return await res.json();
  }

  /**
   * 获取用户信息
   * Get user information
   * @param userAccessToken 用户访问令牌 / User access token
   * @returns Promise 用户信息 / User information
   */
  async getUserInfo(userAccessToken: string) {
    return await this.larkClient.authen.userInfo.get({}, withUserAccessToken(userAccessToken));
  }

  /**
   * 发送消息（通用方法）
   * Send message (generic method)
   * @param params 消息参数 / Message parameters
   * @returns Promise 发送结果 / Send result
   */
  async sendMessage(params: { receiveId: string; content: string; msgType: string }) {
    try {
      const { receiveId, content, msgType } = params;
      const response = await this.larkClient.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: receiveId, msg_type: msgType, content: content },
      });
      if (response.code !== 0) {
        throw new Error(`发送消息失败 / Failed to send message: ${response.msg}`);
      }
      return response.data;
    } catch (error) {
      console.error('发送消息出错 / Error sending message:', error);
      throw error;
    }
  }

  /**
   * 发送分割线消息
   * Send divider message
   * 用于标记新会话的开始
   * Used to mark the beginning of a new session
   * @param receiveId 接收方ID / Receiver ID
   * @returns Promise 发送结果 / Send result
   */
  async sendDividerMessage(receiveId: string) {
    return this.sendMessage({
      receiveId,
      content: JSON.stringify({
        type: 'divider',
        params: { divider_text: { text: '新会话', i18n_text: { zh_CN: '新会话', en_US: 'New Session' } } },
        options: { need_rollup: true },
      }),
      msgType: 'system',
    });
  }

  /**
   * 发送文本消息
   * Send text message
   * @param receiveId 接收方ID / Receiver ID
   * @param text 文本内容 / Text content
   * @returns Promise 发送结果 / Send result
   */
  async sendTextMessage(receiveId: string, text: string): Promise<any> {
    return this.sendMessage({ receiveId, content: JSON.stringify({ text }), msgType: 'text' });
  }

  /**
   * 更新文本消息
   * Update text message
   * @param messageId 消息ID / Message ID
   * @param text 新的文本内容 / New text content
   * @returns Promise 更新结果 / Update result
   */
  async updateTextMessage(messageId: string, text: string): Promise<any> {
    return this.larkClient.im.message.update({
      path: { message_id: messageId },
      data: { msg_type: 'text', content: JSON.stringify({ text }) },
    });
  }

  /**
   * 发送卡片消息
   * Send card message
   * @param receiveId 接收方ID / Receiver ID
   * @param card 卡片对象 / Card object
   * @returns Promise 发送结果 / Send result
   */
  async sendCardMessage(receiveId: string, card: object): Promise<any> {
    return this.sendMessage({ receiveId, content: JSON.stringify(card), msgType: 'interactive' });
  }

  /**
   * 更新卡片消息
   * Update card message
   * @param messageId 消息ID / Message ID
   * @param card 新的卡片对象 / New card object
   * @returns Promise 更新结果 / Update result
   */
  async updateCardMessage(messageId: string, card: object): Promise<any> {
    return this.larkClient.im.message.patch({
      path: { message_id: messageId },
      data: { content: JSON.stringify(card) },
    });
  }
}

// 导出飞书/Lark服务单例实例
// Export Lark service singleton instance
export const larkService = new LarkService();
