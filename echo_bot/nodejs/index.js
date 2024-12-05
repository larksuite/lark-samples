import * as Lark from '@larksuiteoapi/node-sdk';

/**
 * 配置应用基础信息和请求域名。
 * App base information and request domain name.
 */
const baseConfig = {
  // 应用的 AppID, 你可以在开发者后台获取。 AppID of the application, you can get it in the developer console.
  appId: process.env.APP_ID,
  // 应用的 AppSecret，你可以在开发者后台获取。 AppSecret of the application, you can get it in the developer console.
  appSecret: process.env.APP_SECRET,
  // 请求域名，如：https://open.feishu.cn。 Request domain name, such as https://open.feishu.cn.
  domain: process.env.BASE_DOMAIN,
};

/**
 * 创建 LarkClient 对象，用于请求OpenAPI, 并创建 LarkWSClient 对象，用于使用长连接接收事件。
 * Create LarkClient object for requesting OpenAPI, and create LarkWSClient object for receiving events using long connection.
 */
const client = new Lark.Client(baseConfig);
const wsClient = new Lark.WSClient(baseConfig);

/**
 * 注册事件处理器。
 * Register event handler.
 */
const eventDispatcher = new Lark.EventDispatcher({}).register({
  /**
   * 注册接收消息事件，处理接收到的消息。
   * Register event handler to handle received messages.
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
   */
  'im.message.receive_v1': async (data) => {
    const {
      message: { chat_id, content, message_type, chat_type },
    } = data;

    /**
     * 解析用户发送的消息。
     * Parse the message sent by the user.
     */

    let responseText = '';

    try {
      if (message_type === 'text') {
        responseText = JSON.parse(content).text;
      } else {
        responseText = '解析消息失败，请发送文本消息 \nparse message failed, please send text message';
      }
    } catch (error) {
      // 解析消息失败，返回错误信息。 Parse message failed, return error message.
      responseText = '解析消息失败，请发送文本消息 \nparse message failed, please send text message';
    }

    if (chat_type === 'p2p') {
      /**
       * 使用SDK调用发送消息接口。 Use SDK to call send message interface.
       * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
       */
      await client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id', // 消息接收者的 ID 类型，设置为会话ID。 ID type of the message receiver, set to chat ID.
        },
        data: {
          receive_id: chat_id, // 消息接收者的 ID 为消息发送的会话ID。 ID of the message receiver is the chat ID of the message sending.
          content: JSON.stringify({ text: `收到你发送的消息:${responseText}\nReceived message: ${responseText}` }),
          msg_type: 'text', // 设置消息类型为文本消息。 Set message type to text message.
        },
      });
    } else {
      /**
       * 使用SDK调用回复消息接口。 Use SDK to call send message interface.
       * https://open.feishu.cn/document/server-docs/im-v1/message/reply
       */
      await client.im.v1.message.reply({
        path: {
          message_id: data.message.message_id, // 要回复的消息 ID。 Message ID to reply.
        },
        data: {
          content: JSON.stringify({ text: `收到你发送的消息:${responseText}\nReceived message: ${responseText}` }),
          msg_type: 'text', // 设置消息类型为文本消息。 Set message type to text message.
        },
      });
    }
  },
});

/**
 * 启动长连接，并注册事件处理器。
 * Start long connection and register event handler.
 */
wsClient.start({ eventDispatcher });
