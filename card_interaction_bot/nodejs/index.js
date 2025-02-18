import * as Lark from '@larksuiteoapi/node-sdk';

/**
 * 配置应用基础信息和请求域名。
 * App base information and request domain name.
 */
const baseConfig = {
  appId: process.env.APP_ID, // 应用的 AppID, 你可以在开发者后台获取。
  appSecret: process.env.APP_SECRET, // 应用的 AppSecret，你可以在开发者后台获取。
  domain: process.env.BASE_DOMAIN, // 请求域名，如：https://open.feishu.cn。
};

const { WELCOME_CARD_ID, ALERT_CARD_ID, ALERT_RESOLVED_CARD_ID } = process.env;

/**
 * 创建 LarkClient 对象，用于请求OpenAPI, 并创建 LarkWSClient 对象，用于使用长连接接收事件。
 * Create LarkClient object for requesting OpenAPI, and create LarkWSClient object for receiving events using long connection.
 */
const client = new Lark.Client(baseConfig);
const wsClient = new Lark.WSClient(baseConfig);

/**
 * 发送欢迎卡片
 * Construct a welcome card
 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
 * @param {string} openID 用户 open_id
 */
async function sendWelcomeCard(openID) {
  /**
   * 使用发送OpenAPI发送通知卡片，你可以在API接口中打开 API 调试台，快速复制调用示例代码
   * Use send OpenAPI to send notice card. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
   */
  await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: openID,
      msg_type: 'interactive',
      content: JSON.stringify({
        type: 'template',
        data: {
          template_id: WELCOME_CARD_ID,
          template_variable: { open_id: openID },
        },
      }),
    },
  });
}

/**
 * 发送告警卡片
 * Construct an alarm card
 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
 * @param {string} receiveIdType 接收者类型
 * @param {string} receiveId 接收者ID
 */
async function sendAlarmCard(receiveIdType, receiveId) {
  /**
   * 使用发送OpenAPI发送告警卡片，根据传入的receiveIdType不同，可发送到用户单聊或群聊中。你可以在API接口中打开 API 调试台，快速复制调用示例代码
   * Use the Send OpenAPI to send an alarm card. Depending on the value of the incoming receiveIdType, it can be sent to an individual user chat or a group chat. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
   */
  await client.im.v1.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify({
        type: 'template',
        data: {
          template_id: ALERT_CARD_ID,
          template_variable: {
            alarm_time: new Date().toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            }),
          },
        },
      }),
    },
  });
}

/**
 * 注册事件处理器。
 * Register event handler.
 */
const eventDispatcher = new Lark.EventDispatcher({}).register({
  /**
   * 处理用户进入机器人单聊事件
   * handle user enter bot single chat event
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
   */
  'im.chat.access_event.bot_p2p_chat_entered_v1': async (data) => {
    const {
      operator_id: { open_id },
    } = data;
    await sendWelcomeCard(open_id);
  },

  /**
   * 处理用户点击机器人菜单事件
   * handle user click bot menu event
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
   */
  'application.bot.menu_v6': async (data) => {
    const { operator, event_key } = data;
    const {
      operator_id: { open_id },
    } = operator;

    console.log('Received bot menu event:', data);
    
    /**
     * 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
     * Use event_key to distinguish different menus. You can configure the event_key of the menu in the developer console.
     */
    if (event_key === 'send_alarm') {
      await sendAlarmCard('open_id', open_id);
    }
  },

  /**
   * 接收用户发送的消息（包括单聊和群聊），接受到消息后发送告警卡片
   * Register event handler to handle received messages, including individual chats and group chats.
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
   */
  'im.message.receive_v1': async (data) => {
    const {
      message: { chat_type, chat_id },
      sender: { sender_id: { open_id } },
    } = data;
    console.log('Received message:', data);

    if (chat_type === 'group') {
      await sendAlarmCard('chat_id', chat_id);
    } else if (chat_type === 'p2p') {
      await sendAlarmCard('open_id', open_id);
    }
  },

  /**
   * 处理卡片按钮点击回调
   * handle card button click callback
   * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
   */
  'card.action.trigger': async (data) => {
    const {
      operator: { open_id },
      action: { value, form_value = {} },
    } = data;
    console.log('Received card action:', data);

    /**
     * 通过 action 区分不同按钮点击，你可以在卡片搭建工具配置按钮的action。此处处理用户点击了欢迎卡片中的发起告警按钮
     * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
     * Here, handle the situation where the user clicks the "Initiate Alarm" button on the welcome card.
     */
    if (value.action === 'send_alarm') {
      /**
       * 响应回调请求，保持卡片原内容不变
       * Respond to the callback request and keep the original content of the card unchanged.
       */
      await sendAlarmCard('open_id', open_id);
      return {};
    }

    /**
     * 通过 action 区分不同按钮， 你可以在卡片搭建工具配置按钮的action。此处处理用户点击了告警卡片中的已处理按钮
     * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
     * Here, handle the scenario where the user clicks the "Mark as resolved" button on the alarm card.
     */
    if (value.action === 'complete_alarm') {
      /**
       * 读取告警卡片中用户填写的备注文本信息
       * Read the note text information filled in by the user in the alarm card.
       */
      const notes = form_value.notes_input || '';

      return {
        toast: {
          type: 'info',
          content: '已处理完成！',
          i18n: {
            zh_cn: '已处理完成！',
            en_us: 'Resolved!',
          },
        },
        card: {
          type: 'template',
          data: {
            template_id: ALERT_RESOLVED_CARD_ID,
            template_variable: {
              alarm_time: value.time,
              open_id: open_id,
              complete_time: new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }),
              notes: notes,
            },
          },
        },
      };
    }
  },
});

/**
 * 启动长连接，并注册事件处理器。
 * Start long connection and register event handler.
 * https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case#d286cc88
 */
wsClient.start({ eventDispatcher });

console.log('Starting bot...');
