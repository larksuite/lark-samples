import * as Lark from '@larksuiteoapi/node-sdk';

const { APPROVED_CARD_ID, APPROVING_CARD_ID } = process.env;

/**
 * 配置应用基础信息和请求域名。
 * App base information and request domain name.
 */
const baseConfig = {
  appId: process.env.APP_ID, // 应用的 AppID, 你可以在开发者后台获取。
  appSecret: process.env.APP_SECRET, // 应用的 AppSecret，你可以在开发者后台获取。
  domain: process.env.BASE_DOMAIN, // 请求域名，如：https://open.feishu.cn。
};

/**
 * 创建 LarkClient 对象，用于请求OpenAPI, 并创建 LarkWSClient 对象，用于使用长连接接收事件。
 * Create LarkClient object for requesting OpenAPI, and create LarkWSClient object for receiving events using long connection.
 */
const client = new Lark.Client(baseConfig);
const wsClient = new Lark.WSClient(baseConfig);

/**
 * 发送审批卡片
 * Send approval card
 * @param {string} open_id 用户 open_id
 */
async function sendApproveCard(open_id) {
  /**
   * 使用发送OpenAPI发送通知卡片
   * Use send OpenAPI to send notice card
   * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
   */
  await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: {
      receive_id: open_id,
      msg_type: 'interactive',
      content: JSON.stringify({
        type: 'template',
        data: {
          template_id: APPROVING_CARD_ID,
          template_variable: { user_ids: [open_id] },
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
    sendApproveCard(open_id);
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

    /**
     * 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
     * Use event_key to distinguish different menus. You can configure the event_key of the menu in the developer console.
     */
    if (event_key === 'start_approval') {
      sendApproveCard(open_id);
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

    /**
     * 通过 action 区分不同按钮。 你可以在卡片搭建工具配置按钮的action
     * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
     */
    if (value.action === 'confirm_approval') {
      /**
       * 通过卡片回传交互响应审批通过的卡片
       * Response approval card through card callback
       */
      return {
        toast: {
          type: 'success',
          content: 'Approved!',
          i18n: { zh_cn: '已同意！', en_us: 'Approved!' },
        },
        card: {
          type: 'template',
          data: {
            template_id: APPROVED_CARD_ID,
            template_variable: {
              user_ids: [open_id],
              notes: form_value.notes_input, // 接收用户输入的备注。 Receive the notes entered by the user.
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
 */
wsClient.start({ eventDispatcher });
