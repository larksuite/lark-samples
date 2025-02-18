import os
import json
from datetime import datetime

import lark_oapi as lark
from lark_oapi.api.im.v1 import *
from lark_oapi.api.application.v6 import *
from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger,
    P2CardActionTriggerResponse,
)

WELCOME_CARD_ID = os.getenv("WELCOME_CARD_ID")
ALERT_CARD_ID = os.getenv("ALERT_CARD_ID")
ALERT_RESOLVED_CARD_ID = os.getenv("ALERT_RESOLVED_CARD_ID")


# 发送消息
# Send a message
# # https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
def send_message(receive_id_type, receive_id, msg_type, content):
    request = (
        CreateMessageRequest.builder()
        .receive_id_type(receive_id_type)
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(receive_id)
            .msg_type(msg_type)
            .content(content)
            .build()
        )
        .build()
    )

    # 使用发送OpenAPI发送通知卡片，你可以在API接口中打开 API 调试台，快速复制调用示例代码
    # Use send OpenAPI to send notice card. You can open the API debugging console in the API interface and quickly copy the sample code for API calls.
    # https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
    response = client.im.v1.message.create(request)
    if not response.success():
        raise Exception(
            f"client.im.v1.message.create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}"
        )
    return response


# 发送欢迎卡片
# Construct a welcome card
# https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
def send_welcome_card(open_id):
    content = json.dumps(
        {
            "type": "template",
            "data": {
                "template_id": WELCOME_CARD_ID,
                "template_variable": {"open_id": open_id},
            },
        }
    )
    return send_message("open_id", open_id, "interactive", content)


# 发送告警卡片
# Construct an alarm card
# https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card#718fe26b
def send_alarm_card(receive_id_type, receive_id):
    content = json.dumps(
        {
            "type": "template",
            "data": {
                "template_id": ALERT_CARD_ID,
                "template_variable": {
                    "alarm_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                },
            },
        }
    )
    return send_message(receive_id_type, receive_id, "interactive", content)


# 处理用户进入机器人单聊事件
# handle user enter bot single chat event
# https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
def do_p2_im_chat_access_event_bot_p2p_chat_entered_v1(
    data: P2ImChatAccessEventBotP2pChatEnteredV1,
) -> None:
    print(f"[ onP2ChatAccessEventBotP2pChatEnteredV1 access ], data: {data}")
    open_id = data.event.operator_id.open_id
    send_welcome_card(open_id)


# 处理用户点击机器人菜单事件
# handle user click bot menu event
# https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
def do_p2_application_bot_menu_v6(data: P2ApplicationBotMenuV6) -> None:
    print(f"[ onP2BotMenuV6 access ], data: {data}")
    open_id = data.event.operator.operator_id.open_id
    event_key = data.event.event_key

    # 通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
    # Use event_key to distinguish different menus. You can configure the event_key of the menu in the developer console.
    if event_key == "send_alarm":
        send_alarm_card("open_id", open_id)


# 接收用户发送的消息（包括单聊和群聊），接受到消息后发送告警卡片
# Register event handler to handle received messages, including individual chats and group chats.
# https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
def do_p2_im_message_receive_v1(data: P2ImMessageReceiveV1) -> None:
    print(f"[ onP2MessageReceiveV1 access ], data: {data}")
    chat_type = data.event.message.chat_type
    chat_id = data.event.message.chat_id
    open_id = data.event.sender.sender_id.open_id

    if chat_type == "group":
        send_alarm_card("chat_id", chat_id)
    elif chat_type == "p2p":
        send_alarm_card("open_id", open_id)


# 处理卡片按钮点击回调
# handle card button click callback
# https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
def do_p2_card_action_trigger(data: P2CardActionTrigger) -> P2CardActionTriggerResponse:
    print(f"[ P2CardActionTrigger access ], data: {data}")
    open_id = data.event.operator.open_id
    action = data.event.action

    # 通过 action 区分不同按钮点击，你可以在卡片搭建工具配置按钮的action。此处处理用户点击了欢迎卡片中的发起告警按钮
    # Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
    # Here, handle the situation where the user clicks the "Initiate Alarm" button on the welcome card.
    if action.value["action"] == "send_alarm":
        # 响应回调请求，保持卡片原内容不变
        # Respond to the callback request and keep the original content of the card unchanged.
        send_alarm_card("open_id", open_id)
        return P2CardActionTriggerResponse({})

    # 通过 action 区分不同按钮， 你可以在卡片搭建工具配置按钮的action。此处处理用户点击了告警卡片中的已处理按钮
    # Use action to distinguish different buttons. You can configure the action of the button in the card building tool.
    # Here, handle the scenario where the user clicks the "Mark as resolved" button on the alarm card.
    if action.value["action"] == "complete_alarm":
        # 读取告警卡片中用户填写的备注文本信息
        # Read the note text information filled in by the user in the alarm card.
        notes = ""
        if action.form_value and "notes_input" in action.form_value:
            notes = str(action.form_value["notes_input"])

        content = {
            "toast": {
                "type": "info",
                "content": "已处理完成！",
                "i18n": {"zh_cn": "已处理完成！", "en_us": "Resolved!"},
            },
            "card": {
                "type": "template",
                "data": {
                    "template_id": ALERT_RESOLVED_CARD_ID,
                    "template_variable": {
                        "alarm_time": action.value["time"],
                        "open_id": open_id,
                        "complete_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "notes": notes,
                    },
                },
            },
        }
        return P2CardActionTriggerResponse(content)


# 注册事件回调
# Register event handler.
event_handler = (
    lark.EventDispatcherHandler.builder("", "")
    .register_p2_im_chat_access_event_bot_p2p_chat_entered_v1(
        do_p2_im_chat_access_event_bot_p2p_chat_entered_v1
    )
    .register_p2_application_bot_menu_v6(do_p2_application_bot_menu_v6)
    .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1)
    .register_p2_card_action_trigger(do_p2_card_action_trigger)
    .build()
)


# 创建 LarkClient 对象，用于请求OpenAPI, 并创建 LarkWSClient 对象，用于使用长连接接收事件。
# Create LarkClient object for requesting OpenAPI, and create LarkWSClient object for receiving events using long connection.
client = lark.Client.builder().app_id(lark.APP_ID).app_secret(lark.APP_SECRET).build()
wsClient = lark.ws.Client(
    lark.APP_ID,
    lark.APP_SECRET,
    event_handler=event_handler,
    log_level=lark.LogLevel.DEBUG,
)


def main():
    print("Starting bot...")
    # 启动长连接，并注册事件处理器。
    # Start long connection and register event handler.
    # https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case#d286cc88
    wsClient.start()


if __name__ == "__main__":
    main()
