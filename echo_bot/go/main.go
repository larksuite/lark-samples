package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcore "github.com/larksuite/oapi-sdk-go/v3/core"
	"github.com/larksuite/oapi-sdk-go/v3/event/dispatcher"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	larkws "github.com/larksuite/oapi-sdk-go/v3/ws"
)

func main() {
	app_id := os.Getenv("APP_ID")
	app_secret := os.Getenv("APP_SECRET")

	/**
	 * 创建 LarkClient 对象，用于请求OpenAPI。
	 * Create LarkClient object for requesting OpenAPI
	 */
	client := lark.NewClient(app_id, app_secret)

	/**
	 * 注册事件处理器。
	 * Register event handler.
	 */
	eventHandler := dispatcher.NewEventDispatcher("", "").
		/**
		 * 注册接收消息事件，处理接收到的消息。
		 * Register event handler to handle received messages.
		 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
		 */
		OnP2MessageReceiveV1(func(ctx context.Context, event *larkim.P2MessageReceiveV1) error {
			fmt.Printf("[OnP2MessageReceiveV1 access], data: %s\n", larkcore.Prettify(event))
			/**
			 * 解析用户发送的消息。
			 * Parse the message sent by the user.
			 */
			var respContent map[string]string
			err := json.Unmarshal([]byte(*event.Event.Message.Content), &respContent)
			/**
			 * 检查消息类型是否为文本
			 * Check if the message type is text
			 */
			if err != nil || *event.Event.Message.MessageType != "text" {
				respContent = map[string]string{
					"text": "解析消息失败，请发送文本消息\nparse message failed, please send text message",
				}
			}

			/**
			 * 构建回复消息
			 * Build reply message
			 */
			content := larkim.NewTextMsgBuilder().
				TextLine("收到你发送的消息: " + respContent["text"]).
				TextLine("Received message: " + respContent["text"]).
				Build()

			if *event.Event.Message.ChatType == "p2p" {
				/**
				 * 使用SDK调用发送消息接口。 Use SDK to call send message interface.
				 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
				 */
				resp, err := client.Im.Message.Create(context.Background(), larkim.NewCreateMessageReqBuilder().
					ReceiveIdType(larkim.ReceiveIdTypeChatId). // 消息接收者的 ID 类型，设置为会话ID。 ID type of the message receiver, set to chat ID.
					Body(larkim.NewCreateMessageReqBodyBuilder().
						MsgType(larkim.MsgTypeText).            // 设置消息类型为文本消息。 Set message type to text message.
						ReceiveId(*event.Event.Message.ChatId). // 消息接收者的 ID 为消息发送的会话ID。 ID of the message receiver is the chat ID of the message sending.
						Content(content).
						Build()).
					Build())

				if err != nil || !resp.Success() {
					fmt.Println(err)
					fmt.Println(resp.Code, resp.Msg, resp.RequestId())
					return nil
				}

			} else {
				/**
				 * 使用SDK调用回复消息接口。 Use SDK to call send message interface.
				 * https://open.feishu.cn/document/server-docs/im-v1/message/reply
				 */
				resp, err := client.Im.Message.Reply(context.Background(), larkim.NewReplyMessageReqBuilder().
					MessageId(*event.Event.Message.MessageId).
					Body(larkim.NewReplyMessageReqBodyBuilder().
						MsgType(larkim.MsgTypeText). // 设置消息类型为文本消息。 Set message type to text message.
						Content(content).
						Build()).
					Build())
				if err != nil || !resp.Success() {
					fmt.Printf("logId: %s, error response: \n%s", resp.RequestId(), larkcore.Prettify(resp.CodeError))
					return nil
				}
			}

			return nil
		})

	/**
	 * 启动长连接，并注册事件处理器。
	 * Start long connection and register event handler.
	 */
	cli := larkws.NewClient(app_id, app_secret,
		larkws.WithEventHandler(eventHandler),
		larkws.WithLogLevel(larkcore.LogLevelDebug),
	)
	err := cli.Start(context.Background())
	if err != nil {
		panic(err)
	}
}
