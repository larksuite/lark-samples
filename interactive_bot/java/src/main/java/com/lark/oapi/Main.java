package com.lark.oapi;
import java.util.HashMap;

import com.lark.oapi.core.utils.Jsons;
import com.lark.oapi.event.EventDispatcher;
import com.lark.oapi.event.cardcallback.P2CardActionTriggerHandler;
import com.lark.oapi.event.cardcallback.model.CallBackCard;
import com.lark.oapi.event.cardcallback.model.CallBackToast;
import com.lark.oapi.event.cardcallback.model.P2CardActionTrigger;
import com.lark.oapi.event.cardcallback.model.P2CardActionTriggerResponse;
import com.lark.oapi.service.application.ApplicationService;
import com.lark.oapi.service.application.v6.model.P2BotMenuV6;
import com.lark.oapi.service.im.ImService;
import com.lark.oapi.service.im.v1.enums.MsgTypeEnum;
import com.lark.oapi.service.im.v1.enums.ReceiveIdTypeEnum;
import com.lark.oapi.service.im.v1.model.CreateMessageReq;
import com.lark.oapi.service.im.v1.model.CreateMessageReqBody;
import com.lark.oapi.service.im.v1.model.CreateMessageResp;
import com.lark.oapi.service.im.v1.model.P2ChatAccessEventBotP2pChatEnteredV1;
import com.lark.oapi.service.im.v1.model.ext.MessageTemplate;
import com.lark.oapi.service.im.v1.model.ext.MessageTemplateData;

public class Main {

    private static final String APP_ID = System.getenv("APP_ID");
    private static final String APP_SECRET = System.getenv("APP_SECRET");
    private static final String APPROVING_CARD_ID = System.getenv("APPROVING_CARD_ID");
    private static final String APPROVED_CARD_ID = System.getenv("APPROVED_CARD_ID");

    /**
     * 创建 LarkClient 对象，用于请求OpenAPI。
     * Create LarkClient object for requesting OpenAPI
     */
    private static final Client client = new Client.Builder(APP_ID, APP_SECRET).build();

    /**
     * 发送审批卡片
     * Send approval card
     */
    private static void sendApprovalCard(String openID) {

        String[] userIDs = new String[] { openID };

        String replyContent = new MessageTemplate.Builder()
                .data(new MessageTemplateData.Builder().templateId(APPROVING_CARD_ID)
                        .templateVariable(new HashMap<String, Object>() {
                            {
                                put("user_ids", userIDs);
                            }
                        })
                        .build())
                .build();

        CreateMessageReq req = CreateMessageReq.newBuilder()
                .receiveIdType(ReceiveIdTypeEnum.OPEN_ID.getValue())
                .createMessageReqBody(CreateMessageReqBody.newBuilder()
                        .receiveId(openID)
                        .msgType(MsgTypeEnum.MSG_TYPE_INTERACTIVE.getValue())
                        .content(replyContent)
                        .build())
                .build();

        /**
         * 使用发送OpenAPI发送通知卡片
         * Use send OpenAPI to send notice card
         * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
         */
        try {
            CreateMessageResp resp = client.im().message().create(req);
            if (resp.getCode() != 0) {
                System.out.println(String.format("logId: %s, error response: \n%s",
                                        resp.getRequestId(), Jsons.DEFAULT.toJson(resp.getError())));
            }
        } catch (Exception e) {
            // 其他异常处理
            System.out.println(e.getMessage());
        }

    }

    /**
     * 注册事件处理器。
     * Register event handler.
     */
    private static final EventDispatcher EVENT_HANDLER = EventDispatcher.newBuilder("", "") // 长连接不需要这两个参数，请保持空字符串
            /**
             * 处理用户点击机器人菜单事件
             * handle user click bot menu event
             * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
             */
            .onP2BotMenuV6(new ApplicationService.P2BotMenuV6Handler() {
                @Override
                public void handle(P2BotMenuV6 event) throws Exception {
                    System.out.printf("[ onP2BotMenuV6 access ], data: %s\n", Jsons.DEFAULT.toJson(event.getEvent()));
                    /**
                     * 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
                     * Use event_key to distinguish different menus. You can configure the event_key
                     * of the menu in the developer console.
                     */
                    if ("start_approval".equals(event.getEvent().getEventKey())) {
                        String openID = event.getEvent().getOperator().getOperatorId().getOpenId();
                        sendApprovalCard(openID);
                    }

                }
            })
            /**
             * 处理用户进入机器人单聊事件
             * handle user enter bot single chat event
             * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
             */
            .onP2ChatAccessEventBotP2pChatEnteredV1(new ImService.P2ChatAccessEventBotP2pChatEnteredV1Handler() {
                @Override
                public void handle(P2ChatAccessEventBotP2pChatEnteredV1 event) throws Exception {
                    System.out.printf("[ onP2ChatAccessEventBotP2pChatEnteredV1 access ], data: %s\n",
                            Jsons.DEFAULT.toJson(event.getEvent()));
                    String openID = event.getEvent().getOperatorId().getOpenId();
                    sendApprovalCard(openID);
                }

            })
            /**
             * 处理卡片按钮点击回调
             * handle card button click callback
             * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
             */
            .onP2CardActionTrigger(new P2CardActionTriggerHandler() {
                @Override
                public P2CardActionTriggerResponse handle(P2CardActionTrigger event) throws Exception {
                    String[] userIDs = new String[] { event.getEvent().getOperator().getOpenId() };
                    /**
                     * 通过 action 区分不同按钮。 你可以在卡片搭建工具配置按钮的action
                     * Use action to distinguish different buttons. You can configure the action of
                     * the button in the card building tool.
                     */
                    if (event.getEvent().getAction().getValue().get("action").equals("confirm_approval")) {

                        /**
                         * 通过卡片回传交互响应审批通过的卡片
                         * Response approval card through card callback
                         */
                        P2CardActionTriggerResponse resp = new P2CardActionTriggerResponse();
                        CallBackToast toast = new CallBackToast();
                        toast.setType("info");
                        toast.setContent("Approved!");
                        toast.setI18n(new HashMap<String, String>() {
                            {
                                put("zh_cn", "已通过");
                                put("en_us", "Approved");
                            }
                        });

                        CallBackCard card = new CallBackCard();
                        card.setType("template");
                        card.setData(new MessageTemplateData.Builder().templateId(APPROVED_CARD_ID)
                                .templateVariable(new HashMap<String, Object>() {
                                    {
                                        put("user_ids", userIDs);
                                        put("notes", event.getEvent().getAction().getFormValue().get("notes_input"));
                                    }
                                }).build());

                        resp.setCard(card);
                        resp.setToast(toast);
                        return resp;
                    }
                    return null;
                }
            }).build();

    /**
     * 启动长连接，并注册事件处理器。
     * Start long connection and register event handler.
     */
    private static final com.lark.oapi.ws.Client wsClient = new com.lark.oapi.ws.Client.Builder(APP_ID, APP_SECRET)
            .eventHandler(EVENT_HANDLER).build(); // 静态成员变量，只初始化一次

    public static void main(String[] args) {
        System.out.println("Starting bot...");
        wsClient.start();
    }
}
