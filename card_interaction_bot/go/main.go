package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcore "github.com/larksuite/oapi-sdk-go/v3/core"
	"github.com/larksuite/oapi-sdk-go/v3/event/dispatcher"
	"github.com/larksuite/oapi-sdk-go/v3/event/dispatcher/callback"
	larkapplication "github.com/larksuite/oapi-sdk-go/v3/service/application/v6"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	larkws "github.com/larksuite/oapi-sdk-go/v3/ws"
)

/**
 * 发送欢迎卡片
 * Construct a welcome card
 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
 *
 */
func sendWelcomeCard(client *lark.Client, openID string) {
	WELCOME_CARD_ID := os.Getenv("WELCOME_CARD_ID")

	card := &callback.Card{
		Type: "template",
		Data: &callback.TemplateCard{
			TemplateID: WELCOME_CARD_ID,
			TemplateVariable: map[string]interface{}{
				"open_id": openID,
			},
		},
	}

	content, err := json.Marshal(card)
	if err != nil {
		fmt.Println(err)
		return
	}

	/* 使用发送OpenAPI发送通知卡片，你可以在API接口中打开 API 调试台，快速复制调用示例代码
 	* Use send OpenAPI to send notice card. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
 	* https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
 	*/
	resp, err := client.Im.Message.Create(context.Background(), larkim.NewCreateMessageReqBuilder().
		ReceiveIdType("open_id").
		Body(larkim.NewCreateMessageReqBodyBuilder().
			MsgType("interactive").
			ReceiveId(openID).
			Content(string(content)).
			Build()).
		Build())

	if err != nil {
		fmt.Println(err)
		return
	}
	if !resp.Success() {
		fmt.Println(resp.Code, resp.Msg, resp.RequestId())
		return
	}
	fmt.Println(resp.Data.MessageId)
}

/**
 * 构造告警卡片
 * Construct an alarm card
 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
 *
 */
func sendAlarmCard(client *lark.Client, receiveIdType string, receiveId string) {
	ALARM_CARD_ID := os.Getenv("ALARM_CARD_ID")

	card := &callback.Card{
		Type: "template",
		Data: &callback.TemplateCard{
			TemplateID: ALARM_CARD_ID,
			TemplateVariable: map[string]interface{}{
				"alarm_time": time.Now().Format("2006-01-02 15:04:05"),
			},
		},
	}

	content, err := json.Marshal(card)
	if err != nil {
		fmt.Println(err)
		return
	}
	/*
	* 使用发送OpenAPI发送告警卡片，根据传入的receiveIdType不同，可发送到用户单聊或群聊中。你可以在API接口中打开 API 调试台，快速复制调用示例代码
	* Use the Send OpenAPI to send an alarm card. Depending on the value of the incoming receiveIdType, it can be sent to an individual user chat or a group chat. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
	* https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
	*/

	resp, err := client.Im.Message.Create(context.Background(), larkim.NewCreateMessageReqBuilder().
		ReceiveIdType(receiveIdType).
		Body(larkim.NewCreateMessageReqBodyBuilder().
			MsgType("interactive").
			ReceiveId(receiveId).
			Content(string(content)).
			Build()).
		Build())

	if err != nil {
		fmt.Println(err)
		return
	}
	if !resp.Success() {
		fmt.Println(resp.Code, resp.Msg, resp.RequestId())
		return
	}
	fmt.Println(resp.Data.MessageId)
}

func main() {
	app_id := os.Getenv("APP_ID")
	app_secret := os.Getenv("APP_SECRET")
	RESOLVED_CARD_ID := os.Getenv("RESOLVED_CARD_ID")

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
	 	* 处理用户进入机器人单聊事件
		* handle user enter bot single chat event
		* https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
		*/
		OnP2ChatAccessEventBotP2pChatEnteredV1(func(ctx context.Context, event *larkim.P2ChatAccessEventBotP2pChatEnteredV1) error {
			
			fmt.Printf("[ OnP2ChatAccessEventBotP2pChatEnteredV1 access ], data: %s\n", larkcore.Prettify(event))
			sendWelcomeCard(client, *event.Event.OperatorId.OpenId)
			return nil
		}).
		/**
		* 处理用户点击机器人菜单事件
		* handle user click bot menu event
		* https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
		*/
		OnP2BotMenuV6(func(ctx context.Context, event *larkapplication.P2BotMenuV6) error {
			 /**
			 * 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
			 * Use event_key to distinguish different menus. You can configure the event_key
			 * of the menu in the developer console.
			 */
			fmt.Printf("[ OnP2BotMenuV6 access ], data: %s\n", larkcore.Prettify(event))
			if *event.Event.EventKey == "send_alarm" {
				sendAlarmCard(client, "open_id", *event.Event.Operator.OperatorId.OpenId)
			}
			return nil
		}).
		/**
		 * 接收用户发送的消息（包括单聊和群聊），接受到消息后发送告警卡片
		 * Register event handler to handle received messages, including individual chats and group chats.
		 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
		 */
		OnP2MessageReceiveV1(func(ctx context.Context, event *larkim.P2MessageReceiveV1) error {
			fmt.Printf("[ OnP2MessageReceiveV1 access ], data: %s\n", larkcore.Prettify(event))
			if *event.Event.Message.ChatType == "group" {
				sendAlarmCard(client, "chat_id", *event.Event.Message.ChatId)
			} else if *event.Event.Message.ChatType == "p2p" {
				sendAlarmCard(client, "open_id", *event.Event.Sender.SenderId.OpenId)
			}
			return nil
		}).
		/**
		 * 处理卡片按钮点击回调
		 * handle card button click callback
		 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
		 */
		OnP2CardActionTrigger(func(ctx context.Context, event *callback.CardActionTriggerEvent) (*callback.CardActionTriggerResponse, error) {
			fmt.Printf("[ OnP2CardActionTrigger access ], data: %s\n", larkcore.Prettify(event))
			/**
			 * 通过 action 区分不同按钮点击，你可以在卡片搭建工具配置按钮的action。此处处理用户点击了欢迎卡片中的发起告警按钮
			 * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
			 * Here, handle the situation where the user clicks the "Initiate Alarm" button on the welcome card.
			 */
			if event.Event.Action.Value["action"] == "send_alarm" {
				 /*
				 * 响应回调请求，保持卡片原内容不变
				 * Respond to the callback request and keep the original content of the card unchanged.
				 */
				sendAlarmCard(client, "open_id", event.Event.Operator.OpenID)
				return &callback.CardActionTriggerResponse{}, nil
			}
			/**
			* 通过 action 区分不同按钮， 你可以在卡片搭建工具配置按钮的action。此处处理用户点击了告警卡片中的已处理按钮
	    	* Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
			 * Here, handle the scenario where the user clicks the "Mark as resolved" button on the alarm card.
			 */
			if event.Event.Action.Value["action"] == "complete_alarm" {
				/*
				 * 读取告警卡片中用户填写的备注文本信息
				 * Read the note text information filled in by the user in the alarm card.
				 */
				notes := ""
				if event.Event.Action.FormValue != nil {
					if n, ok := event.Event.Action.FormValue["notes_input"]; ok {
						if str, ok := n.(string); ok {
							notes = str
						} else {
							notes = fmt.Sprintf("%v", n)
						}
					}
				}

				card := callback.CardActionTriggerResponse{
					Toast: &callback.Toast{
						Type:    "info",
						Content: "已处理完成！",
						I18nContent: map[string]string{
							"zh_cn": "已处理完成！",
							"en_us": "Resolved!",
						},
					},
					Card: &callback.Card{
						Type: "template",
						Data: &callback.TemplateCard{
							TemplateID: RESOLVED_CARD_ID,
							TemplateVariable: map[string]interface{}{
								"alarm_time":    event.Event.Action.Value["time"],
								"open_id":       event.Event.Operator.OpenID,
								"complete_time": time.Now().Format("2006-01-02 15:04:05"),
								"notes":         notes,
							},
						},
					},
				}
				return &card, nil
			}

			return nil, nil
		})

	/**
	 * 启动长连接，并注册事件处理器。
	 * Start long connection and register event handler.
	 * https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case#d286cc88
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