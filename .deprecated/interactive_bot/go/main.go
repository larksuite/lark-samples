package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcore "github.com/larksuite/oapi-sdk-go/v3/core"
	"github.com/larksuite/oapi-sdk-go/v3/event/dispatcher"
	"github.com/larksuite/oapi-sdk-go/v3/event/dispatcher/callback"
	larkapplication "github.com/larksuite/oapi-sdk-go/v3/service/application/v6"
	larkim "github.com/larksuite/oapi-sdk-go/v3/service/im/v1"
	larkws "github.com/larksuite/oapi-sdk-go/v3/ws"
)

/**
 * 发送审批卡片
 * Send approval card
 */

func sendApprovalCard(client *lark.Client, open_id string) {
	APPROVING_CARD_ID := os.Getenv("APPROVING_CARD_ID")

	card := &callback.Card{
		Type: "template",
		Data: &callback.TemplateCard{
			TemplateID: APPROVING_CARD_ID,
			TemplateVariable: map[string]interface{}{
				"user_ids": []string{open_id},
			},
		},
	}

	content, err := json.Marshal(card)

	if err != nil {
		fmt.Println(err)
		return
	}

	/**
	 * 使用OpenAPI发送通知卡片
	 * Use send OpenAPI to send notice card
	 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
	 */
	resp, err := client.Im.Message.Create(context.Background(), larkim.NewCreateMessageReqBuilder().
		ReceiveIdType(larkim.ReceiveIdTypeOpenId).
		Body(larkim.NewCreateMessageReqBodyBuilder().
			MsgType(larkim.MsgTypeInteractive).
			ReceiveId(open_id).
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
	APPROVED_CARD_ID := os.Getenv("APPROVED_CARD_ID")

	/**
	 * 创建 LarkClient 对象，用于请求OpenAPI。
	 * Create LarkClient object for requesting OpenAPI
	 */
	client := lark.NewClient(app_id, app_secret)

	/**
	 * 注册事件处理器。
	 * Register event handler.
	 */
	eventHandler := dispatcher.NewEventDispatcher("", "").OnP2BotMenuV6(func(ctx context.Context, event *larkapplication.P2BotMenuV6) error {
		/**
		 * 处理用户点击机器人菜单事件
		 * handle user click bot menu event
		 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
		 */
		fmt.Printf("[ OnP2MessageReceiveV1 access ], data: %s\n", larkcore.Prettify(event))
		/**
		 * 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
		 * Use event_key to distinguish different menus. You can configure the event_key of the menu in the developer console.
		 */
		if *event.Event.EventKey == "start_approval" {
			sendApprovalCard(client, *event.Event.Operator.OperatorId.OpenId)
		}
		return nil
	}).OnP2ChatAccessEventBotP2pChatEnteredV1(func(ctx context.Context, event *larkim.P2ChatAccessEventBotP2pChatEnteredV1) error {
		/**
		 * 处理用户进入机器人单聊事件
		 * handle user enter bot single chat event
		 * https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
		 */
		fmt.Printf("[ OnP2MessageReceiveV1 access ], data: %s\n", larkcore.Prettify(event))
		sendApprovalCard(client, *event.Event.OperatorId.OpenId)
		return nil
	}).OnP2CardActionTrigger(func(ctx context.Context, event *callback.CardActionTriggerEvent) (*callback.CardActionTriggerResponse, error) {
		/**
		 * 处理卡片按钮点击回调
		 * handle card button click callback
		 * https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
		 */
		fmt.Printf("[ OnP2MessageReceiveV1 access ], data: %s\n", larkcore.Prettify(event))
		/**
		 * 通过 action 区分不同按钮。 你可以在卡片搭建工具配置按钮的action
		 * Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
		 */
		if event.Event.Action.Value["action"] == "confirm_approval" {
			/**
			 * 通过卡片回传交互响应审批通过的卡片
			 * Response approval card through card callback
			 */
			card := callback.CardActionTriggerResponse{
				Toast: &callback.Toast{
					Type:    "success",
					Content: "Approved!",
					I18nContent: map[string]string{
						"zh_cn": "已通过",
						"en_us": "Approved!",
					},
				},
				Card: &callback.Card{
					Type: "template",
					Data: &callback.TemplateCard{
						TemplateID: APPROVED_CARD_ID,
						TemplateVariable: map[string]interface{}{
							"user_ids": []string{event.Event.Operator.OpenID},
							"notes":    event.Event.Action.FormValue["notes_input"],
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
