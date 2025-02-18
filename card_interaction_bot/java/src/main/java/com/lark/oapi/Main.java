package com.lark.oapi;

import java.nio.charset.StandardCharsets;
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
import com.lark.oapi.service.im.v1.model.CreateMessageReq;
import com.lark.oapi.service.im.v1.model.CreateMessageReqBody;
import com.lark.oapi.service.im.v1.model.CreateMessageResp;
import com.lark.oapi.service.im.v1.model.P2ChatAccessEventBotP2pChatEnteredV1;
import com.lark.oapi.service.im.v1.model.P2MessageReceiveV1;
import com.lark.oapi.service.im.v1.model.ext.MessageTemplate;
import com.lark.oapi.service.im.v1.model.ext.MessageTemplateData;
import com.google.gson.JsonParser;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;


public class Main {

    private static final String APP_ID = System.getenv("APP_ID");
    private static final String APP_SECRET = System.getenv("APP_SECRET");
    private static final String WELCOME_CARD_ID = System.getenv("WELCOME_CARD_ID");
    private static final String ALARM_CARD_ID = System.getenv("ALARM_CARD_ID");
    private static final String RESOLVED_CARD_ID = System.getenv("RESOLVED_CARD_ID");


    /**
     * 创建 LarkClient 对象，用于请求OpenAPI。
     * Create LarkClient object for requesting OpenAPI
     */
    private static final Client client = new Client.Builder(APP_ID, APP_SECRET).build();

    /*
     * 
     * 发送欢迎卡片
     * Send welcome card
     * 
     */

    private static void sendWelcomeCard(String openID) throws Exception {
        /*
         * 构造欢迎卡片
         * Construct a welcome card
         * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
         */
        String replyContent = new MessageTemplate.Builder()
                .data(new MessageTemplateData.Builder().templateId(WELCOME_CARD_ID)
                        .templateVariable(new HashMap<String, Object>() {
                            {
                                put("open_id", openID);
                            }
                        })
                        .build())
                .build();
        
        /**
         * 使用发送OpenAPI发送通知卡片，你可以在API接口中打开 API 调试台，快速复制调用示例代码
         * Use send OpenAPI to send notice card. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
         * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
         */
        CreateMessageReq req = CreateMessageReq.newBuilder()
                .receiveIdType("open_id")
                .createMessageReqBody(CreateMessageReqBody.newBuilder()
                        .receiveId(openID)
                        .msgType("interactive")
                        .content(replyContent)
                        .build())
                .build();

        // 发起请求
		CreateMessageResp resp = client.im().v1().message().create(req);

		// 处理服务端错误
		if(!resp.success()) {
			System.out.println(String.format("code:%s,msg:%s,reqId:%s, resp:%s",
				resp.getCode(), resp.getMsg(), resp.getRequestId(), Jsons.createGSON(true, false).toJson(JsonParser.parseString(new String(resp.getRawResponse().getBody(), StandardCharsets.UTF_8)))));
			return;
		}

		// 调用成功，打印返回结果
		System.out.println(Jsons.DEFAULT.toJson(resp.getData()));
	
    }

    /**
     * 发送告警卡片
     * Send alarm card
     */
    private static void sendAlarmCard(String receiveIdType, String receiveId) throws Exception {
        /*
         * 构造告警卡片
         * Construct an alarm card
         * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
         */
        String replyContent = new MessageTemplate.Builder()
                .data(new MessageTemplateData.Builder().templateId(ALARM_CARD_ID)
                    .templateVariable(new HashMap<String, Object>() {
                        {
                            put("alarm_time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                        }
                    })
                    .build())
                .build();

        /**
         * 使用发送OpenAPI发送告警卡片，根据传入的receiveIdType不同，可发送到用户单聊或群聊中。你可以在API接口中打开 API 调试台，快速复制调用示例代码
         * Use the Send OpenAPI to send an alarm card. Depending on the value of the incoming receiveIdType, it can be sent to an individual user chat or a group chat. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
         * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
         */
        CreateMessageReq req = CreateMessageReq.newBuilder()
                .receiveIdType(receiveIdType)
                .createMessageReqBody(CreateMessageReqBody.newBuilder()
                        .receiveId(receiveId)
                        .msgType("interactive")
                        .content(replyContent)
                        .build())
                .build();

        
        // 发起请求
		CreateMessageResp resp = client.im().v1().message().create(req);

		// 处理服务端错误
		if(!resp.success()) {
			System.out.println(String.format("code:%s,msg:%s,reqId:%s, resp:%s",
				resp.getCode(), resp.getMsg(), resp.getRequestId(), Jsons.createGSON(true, false).toJson(JsonParser.parseString(new String(resp.getRawResponse().getBody(), StandardCharsets.UTF_8)))));
			return;
		}

		// 调用成功，打印返回结果
		System.out.println(Jsons.DEFAULT.toJson(resp.getData()));

    }

    /**
     * 注册事件处理器。
     * Register event handler.
     */
    private static final EventDispatcher EVENT_HANDLER = EventDispatcher.newBuilder("", "") // 长连接不需要这两个参数，请保持空字符串
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
                    sendWelcomeCard(openID);
                }

            })

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
                    if ("send_alarm".equals(event.getEvent().getEventKey())) {
                        String openID = event.getEvent().getOperator().getOperatorId().getOpenId();
                        sendAlarmCard("open_id", openID);
                    }

                }
            })

            /**
             * 接收用户发送的消息（包括单聊和群聊），接受到消息后发送告警卡片
             * Register event handler to handle received messages, including individual chats and group chats.
             * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
             */
            .onP2MessageReceiveV1(new ImService.P2MessageReceiveV1Handler() {
                @Override
                public void handle(P2MessageReceiveV1 event) throws Exception {
                    System.out.printf("[ onP2MessageReceiveV1 access ], data: %s\n", Jsons.DEFAULT.toJson(event.getEvent()));
                    String type = event.getEvent().getMessage().getChatType();
                    String openID = event.getEvent().getSender().getSenderId().getOpenId();
                    String chatID = event.getEvent().getMessage().getChatId();
                    if (type.equals("group")) {
                        sendAlarmCard("chat_id", chatID);
                    } else if (type.equals("p2p")) {
                        sendAlarmCard("open_id", openID);
                    }

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
                    System.out.printf("[ P2CardActionTrigger access ], data: %s\n", Jsons.DEFAULT.toJson(event.getEvent()));
                    String openID = event.getEvent().getOperator().getOpenId();
                    

                    /**
                     * 通过 action 区分不同按钮点击，你可以在卡片搭建工具配置按钮的action。此处处理用户点击了欢迎卡片中的发起告警按钮
                     * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
                     * Here, handle the situation where the user clicks the "Initiate Alarm" button on the welcome card.
                     * 
                     */
                    if (event.getEvent().getAction().getValue().get("action").equals("send_alarm")) {

                        /**
                         * 响应回调请求，保持卡片原内容不变
                         * Respond to the callback request and keep the original content of the card unchanged.
                         */
                        P2CardActionTriggerResponse resp = new P2CardActionTriggerResponse();
                        sendAlarmCard("open_id", openID);
                        return resp;
                    }

                    /**
                     * 通过 action 区分不同按钮， 你可以在卡片搭建工具配置按钮的action。此处处理用户点击了告警卡片中的已处理按钮
                     * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
                     * Here, handle the scenario where the user clicks the "Mark as resolved" button on the alarm card.
                     */

                    if (event.getEvent().getAction().getValue().get("action").equals("complete_alarm")) {                       
                        /**
                         * 读取告警卡片中用户填写的备注文本信息
                         * Read the note text information filled in by the user in the alarm card.
                         */
                        String notes;
                        if (event.getEvent().getAction().getFormValue() != null) {
                            notes =String.valueOf(event.getEvent().getAction().getFormValue().get("notes_input"));
                        } else {
                            notes= "";
                        }
                        System.out.printf("[ notes ], data: %s\n", notes);
                        /**
                         * 通过卡片回传交互toast提示操作成功，并返回一个新卡片：已处理的卡片
                         * Through the card callback interaction, display a toast to indicate successful operation and return a new card: the resolved card.
                         */
                        P2CardActionTriggerResponse resp = new P2CardActionTriggerResponse();
                        CallBackToast toast = new CallBackToast();
                        toast.setType("info");
                        toast.setContent("已处理完成！");
                        toast.setI18n(new HashMap<String, String>() {
                            {
                                put("zh_cn", "已处理完成！");
                                put("en_us", "Resolved！");
                            }
                        });

                        CallBackCard card = new CallBackCard();
                        card.setType("template");
                        card.setData(new MessageTemplateData.Builder().templateId(RESOLVED_CARD_ID)
                                .templateVariable(new HashMap<String, Object>() {
                                    {
                                        put("alarm_time", event.getEvent().getAction().getValue().get("time"));
                                        put("open_id", openID);
                                        put("complete_time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                                        put("notes", notes);
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
     * https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case#d286cc88
     */
    private static final com.lark.oapi.ws.Client wsClient = new com.lark.oapi.ws.Client.Builder(APP_ID, APP_SECRET)
            .eventHandler(EVENT_HANDLER).build(); // 静态成员变量，只初始化一次

    public static void main(String[] args) {
        System.out.println("Starting bot...");
        wsClient.start();
    }
}
