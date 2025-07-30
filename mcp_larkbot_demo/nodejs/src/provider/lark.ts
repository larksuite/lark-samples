/**
 * 飞书/Lark聊天提供者实现
 * Lark Chat Provider Implementation
 *
 * 功能说明:
 * - 实现飞书/Lark平台的消息收发
 * - 处理飞书/LarkOAuth授权流程
 * - 生成飞书/Lark卡片消息格式
 * - 监听飞书/LarkWebhook事件
 *
 * Features:
 * - Implement Lark platform message sending/receiving
 * - Handle Lark OAuth authorization flow
 * - Generate Lark card message format
 * - Listen to Lark webhook events
 */

import * as Lark from '@larksuiteoapi/node-sdk';
import { larkService } from '../service/lark';
import { AuthInfo, ChatProvider, Message } from './type';
import { safeParseJSON } from '../util';
import { Express, Request, Response } from 'express';
import { config } from '../config';
import { parseMessages2Markdown } from '../util/message';

/**
 * 生成飞书/Lark卡片消息格式
 * Generate Lark card message format
 * @param content 消息内容 / Message content
 * @returns 飞书/Lark卡片JSON结构 / Lark card JSON structure
 */
export function generateLarkCardMessage(content: string) {
  return {
    schema: '2.0',
    config: {
      update_multi: true,
      streaming_mode: false,
    },
    body: {
      direction: 'vertical',
      padding: '12px 12px 12px 12px',
      elements: [
        {
          tag: 'markdown',
          content,
          text_align: 'left',
          text_size: 'normal',
          margin: '0px 0px 0px 0px',
        },
      ],
    },
  };
}

/**
 * 飞书/Lark聊天提供者类
 * Lark Chat Provider Class
 * 实现ChatProvider接口，提供飞书/Lark平台特有的功能
 * Implements ChatProvider interface with Lark platform-specific features
 */
export class LarkChatProvider implements ChatProvider {
  /**
   * 获取飞书/LarkOAuth授权URL
   * Get Lark OAuth authorization URL
   */
  get authorizeUrl() {
    return larkService.authorizeUrl;
  }

  /**
   * 发送消息到飞书/Lark聊天
   * Send message to Lark chat
   * @param chatId 飞书/Lark聊天ID / Lark chat ID
   * @param message 消息内容 / Message content
   * @returns 包含消息ID的对象 / Object containing message ID
   */
  async sendMessage(chatId: string, message: Message): Promise<{ messageId: string }> {
    // 如果消息不是字符串，转换为Markdown格式
    // If message is not string, convert to Markdown format
    if (typeof message !== 'string') {
      message = parseMessages2Markdown(message);
    }

    const { message_id } = await larkService.sendCardMessage(chatId, generateLarkCardMessage(message));
    return { messageId: message_id };
  }

  /**
   * 更新已发送的飞书/Lark消息
   * Update sent Lark message
   * @param messageId 消息ID / Message ID
   * @param message 新的消息内容 / New message content
   */
  async updateMessage(messageId: string, message: Message): Promise<void> {
    if (typeof message !== 'string') {
      message = parseMessages2Markdown(message);
    }
    return await larkService.updateCardMessage(messageId, generateLarkCardMessage(message));
  }

  /**
   * 注册OAuth授权回调处理器
   * Register OAuth authorization callback handler
   * @param app Express应用实例 / Express application instance
   * @param onAuth 授权完成回调函数 / Authorization completion callback function
   */
  async registerAuthCallback(app: Express, onAuth: (authInfo: AuthInfo) => Promise<void>) {
    // 注册OAuth回调路由
    // Register OAuth callback route
    app.use(config.lark.callbackPath, async (req: Request, res: Response): Promise<void> => {
      try {
        // 从查询参数中获取授权码
        // Get authorization code from query parameters
        const code = req.query.code as string;
        if (!code) {
          res.status(400).end('授权码不能为空 / Authorization code cannot be empty');
          return;
        }

        // 使用授权码获取用户访问令牌
        // Use authorization code to get user access token
        const authToken = await larkService.getUserAccessToken(code);

        // 使用访问令牌获取用户信息
        // Use access token to get user information
        const userInfo = await larkService.getUserInfo(authToken.access_token);

        // 检查是否成功获取用户OpenID
        // Check if user OpenID is successfully obtained
        if (!userInfo.data?.open_id) {
          res.status(500).end('登录失败 / Login failed');
          return;
        }

        // 调用授权完成回调，传递认证信息
        // Call authorization completion callback with auth info
        await onAuth({
          userId: userInfo.data?.open_id,
          accessToken: authToken.access_token,
          refreshToken: authToken.refresh_token,
          expiresAt: authToken.expires_in * 1000 + new Date().getTime(),
        });

        // 重定向到成功页面
        // Redirect to success page
        res.redirect('/auth.html');
      } catch (error) {
        console.error('处理授权回调时出错 / Error processing authorization callback:', error);
        res.status(500).end('处理授权回调时出错 / Error processing authorization callback');
      }
    });
  }

  protected getLarkEventDispatcher(onMessage: (userId: string, chatId: string, query: string) => Promise<void>) {
    return new Lark.EventDispatcher({}).register({
      // 注册即时消息接收事件处理器
      // Register IM message receive event handler
      'im.message.receive_v1': event => {
        (async () => {
          const messageEvent = event;

          // 提取消息相关信息
          // Extract message related information
          const userId = messageEvent.sender?.sender_id?.open_id || '';
          const chatId = messageEvent.message.chat_id || '';
          const messageType = messageEvent.message?.message_type || '';

          // 只处理文本和富文本消息
          // Only handle text and post messages
          if (messageType !== 'text' && messageType !== 'post') {
            await larkService.sendTextMessage(chatId, '请发送文本消息 / Please send text message');
            return;
          }

          // 解析消息内容
          // Parse message content
          const content = safeParseJSON(messageEvent.message.content, { text: '' });
          const query = messageType === 'text' ? content.text.trim() : JSON.stringify(content);
          if (!query) {
            return;
          }

          // 调用消息处理回调
          // Call message processing callback
          await onMessage(userId, chatId, query);
        })();
      },
    });
  }

  /**
   * 注册消息接收事件监听器
   * Register message receive event listener
   * @param _app Express应用实例（未使用，飞书/Lark使用WebSocket连接）/ Express app instance (unused, Lark uses WebSocket)
   * @param onMessage 消息处理回调函数 / Message processing callback function
   */
  async registerMessageReceiveEvent(
    _app: Express,
    onMessage: (userId: string, chatId: string, query: string) => Promise<void>
  ) {
    const dispatcher = this.getLarkEventDispatcher(onMessage);

    // 启动飞书/LarkWebSocket客户端监听事件
    // Start Lark WebSocket client to listen for events
    larkService.larkWsClient.start({ eventDispatcher: dispatcher });
  }
}

export class LarkWebhookChatProvider extends LarkChatProvider {
  async registerMessageReceiveEvent(
    app: Express,
    onMessage: (userId: string, chatId: string, query: string) => Promise<void>
  ) {
    const dispatcher = this.getLarkEventDispatcher(onMessage);
    app.use('/webhook/event', Lark.adaptExpress(dispatcher, { autoChallenge: true }));
  }
}
