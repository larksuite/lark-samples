import os
import json
import lark_oapi as lark
from lark_oapi.api.im.v1 import *
from lark_oapi.api.application.v6 import *
from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger,
    P2CardActionTriggerResponse,
)


APPROVING_CARD_ID = os.getenv("APPROVING_CARD_ID")
APPROVED_CARD_ID = os.getenv("APPROVED_CARD_ID")


#  发送审批卡片
#  Send approval card
#  @param {string} open_id
def send_approval_card(open_id):
    request = (
        CreateMessageRequest.builder()
        .receive_id_type("open_id")
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(open_id)
            .msg_type("interactive")
            .content(
                json.dumps(
                    {
                        "type": "template",
                        "data": {
                            "template_id": APPROVING_CARD_ID,
                            "template_variable": {"user_ids": [open_id]},
                        },
                    }
                )
            )
            .build()
        )
        .build()
    )

    # 使用发送OpenAPI发送通知卡片
    # Use send OpenAPI to send notice card
    # https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
    response = client.im.v1.chat.create(request)

    if not response.success():
        raise Exception(
            f"client.im.v1.chat.create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}"
        )


# 处理用户进入机器人单聊事件
# handle user enter bot single chat event
# https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-access_event/events/bot_p2p_chat_entered
def do_p2_im_chat_access_event_bot_p2p_chat_entered_v1(
    data: P2ImChatAccessEventBotP2pChatEnteredV1,
) -> None:
    open_id = data.event.operator_id.open_id
    send_approval_card(open_id)


# 处理用户点击机器人菜单事件
# handle user click bot menu event
# https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v6/bot/events/menu
def do_p2_application_bot_menu_v6(data: P2ApplicationBotMenuV6) -> None:
    open_id = data.event.operator.operator_id.open_id
    event_key = data.event.event_key
    #  通过菜单 event_key 区分不同菜单。 你可以在开发者后台配置菜单的event_key
    #  Use event_key to distinguish different menus. You can configure the event_key of the menu in the developer console.
    if event_key == "start_approval":
        send_approval_card(open_id)


#  处理卡片按钮点击回调
#  handle card button click callback
#  https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-callback-communication
def do_p2_card_action_trigger(data: P2CardActionTrigger) -> None:
    open_id = data.event.operator.open_id
    action = data.event.action
    if action.value["action"] == "confirm_approval":
        # 通过卡片回传交互响应审批通过的卡片
        # Response approval card through card callback
        content = {
            "toast": {
                "type": "success",
                "content": "Approved!",
                "i18n": {"zh_cn": "已同意！", "en_us": "Approved!"},
            },
            "card": {
                "type": "template",
                "data": {
                    "template_id": APPROVED_CARD_ID,
                    "template_variable": {
                        "user_ids": [open_id],
                        "notes": action.form_value["notes_input"],
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
    #  启动长连接，并注册事件处理器。
    #  Start long connection and register event handler.
    wsClient.start()


if __name__ == "__main__":
    main()
