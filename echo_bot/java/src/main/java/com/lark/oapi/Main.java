package com.lark.oapi;

import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.gson.reflect.TypeToken;
import com.lark.oapi.core.utils.Jsons;
import com.lark.oapi.event.EventDispatcher;
import com.lark.oapi.service.im.ImService;
import com.lark.oapi.service.im.v1.enums.MsgTypeEnum;
import com.lark.oapi.service.im.v1.enums.ReceiveIdTypeEnum;
import com.lark.oapi.service.im.v1.model.CreateMessageReq;
import com.lark.oapi.service.im.v1.model.CreateMessageReqBody;
import com.lark.oapi.service.im.v1.model.CreateMessageResp;
import com.lark.oapi.service.im.v1.model.P2MessageReceiveV1;
import com.lark.oapi.service.im.v1.model.ReplyMessageReq;
import com.lark.oapi.service.im.v1.model.ReplyMessageReqBody;
import com.lark.oapi.service.im.v1.model.ReplyMessageResp;
import com.lark.oapi.service.im.v1.model.ext.MessageText;

public class Main {

    private static final String APP_ID = System.getenv("APP_ID");
    private static final String APP_SECRET = System.getenv("APP_SECRET");
    /**
     * 创建 LarkClient 对象，用于请求OpenAPI。
     * Create LarkClient object for requesting OpenAPI
     */
    private static final Client client = new Client.Builder(APP_ID, APP_SECRET).build();

    /**
     * 注册事件处理器。
     * Register event handler.
     */
    private static final EventDispatcher EVENT_HANDLER = EventDispatcher.newBuilder("", "")
            /**
             * 注册接收消息事件，处理接收到的消息。
             * Register event handler to handle received messages.
             * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
             */
            .onP2MessageReceiveV1(new ImService.P2MessageReceiveV1Handler() {
                @Override
                public void handle(P2MessageReceiveV1 event) throws Exception {
                    System.out.printf("[ onP2MessageReceiveV1 access ], data: %s\n",
                            Jsons.DEFAULT.toJson(event.getEvent()));
                    /**
                     * 解析用户发送的消息。
                     * Parse the message sent by the user.
                     */
                    String content = event.getEvent().getMessage().getContent();
                    Map<String, String> respContent;
                    try {
                        respContent = new Gson().fromJson(content, new TypeToken<Map<String, String>>() {
                        }.getType());
                    } catch (JsonSyntaxException e) {
                        respContent = Map.of("text", "解析消息失败，请发送文本消息\nparse message failed, please send text message");
                    }

                    /**
                     * 检查消息类型是否为文本
                     * Check if the message type is text
                     */
                    if (!event.getEvent().getMessage().getMessageType().equals("text")) {
                        respContent = Map.of("text", "解析消息失败，请发送文本消息\nparse message failed, please send text message");
                    }

                    /**
                     * 构建回复消息
                     * Build reply message
                     */
                    String replyContent = new MessageText.Builder()
                            .textLine("收到你发送的消息: " + respContent.get("text"))
                            .textLine("Received message: " + respContent.get("text"))
                            .build();

                    if (event.getEvent().getMessage().getChatType().equals("p2p")) {
                        CreateMessageReq req = CreateMessageReq.newBuilder()
                                .receiveIdType(ReceiveIdTypeEnum.CHAT_ID.getValue())
                                .createMessageReqBody(CreateMessageReqBody.newBuilder()
                                        .receiveId(event.getEvent().getMessage().getChatId())
                                        .msgType(MsgTypeEnum.MSG_TYPE_TEXT.getValue())
                                        .content(replyContent)
                                        .build())
                                .build();

                        /**
                         * 使用SDK调用发送消息接口。 Use SDK to call send message interface.
                         * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
                         */
                        try {
                            CreateMessageResp resp = client.im().message().create(req);
                            if (resp.getCode() != 0) {
                                System.out.println(String.format("logId: %s, error response: \n%s",
                                        resp.getRequestId(), Jsons.DEFAULT.toJson(resp.getError())));
                            }
                        } catch (Exception e) {
                            System.out.println(e.getMessage());
                        }
                    } else {
                        /**
                         * 使用SDK调用回复消息接口。 Use SDK to call reply message interface.
                         * https://open.feishu.cn/document/server-docs/im-v1/message/reply
                         */
                        ReplyMessageReq req = ReplyMessageReq.newBuilder()
                                .messageId(event.getEvent().getMessage().getMessageId())
                                .replyMessageReqBody(ReplyMessageReqBody.newBuilder()
                                        .content(replyContent)
                                        .msgType("text")
                                        .build())
                                .build();
                        try {
                            // 发起请求
                            ReplyMessageResp resp = client.im().message().reply(req);
                            if (resp.getCode() != 0) {
                                System.out.println(String.format("logId: %s, error response: \n%s", resp.getRequestId(), Jsons.DEFAULT.toJson(resp.getError())));
                            }
                        } catch (Exception e) {
                            System.out.println(e.getMessage());
                        }
                    }

                }
            })
            .build();

    /**
     * 启动长连接，并注册事件处理器。
     * Start long connection and register event handler.
     */
    private static final com.lark.oapi.ws.Client wsClient = new com.lark.oapi.ws.Client.Builder(APP_ID, APP_SECRET)
            .eventHandler(EVENT_HANDLER).build();

    public static void main(String[] args) {
        System.out.println("Starting bot...");
        wsClient.start();
    }
}
