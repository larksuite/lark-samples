import lark_oapi as lark
from lark_oapi.api.im.v1 import *
from lark_oapi.api.bitable.v1 import CreateAppTableRecordRequest
from lark_oapi.api.contact.v3 import *
from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger,
    P2CardActionTriggerResponse,
)
import json
import re
from urllib.parse import urlparse, urlunparse
import traceback
import time
from typing import Dict
import os
import uuid

# 每个运行实例的唯一ID（用于识别是否为旧部署）
INSTANCE_ID = os.getenv("INSTANCE_ID", str(uuid.uuid4()))

# ====================== 全局去重配置（带过期清理，防止内存泄漏） ======================
PROCESSED_MESSAGE_IDS: Dict[str, float] = {}
DUPLICATE_EXPIRE_SECONDS = 300  # 5分钟过期
# ====================================================================================

# ====================== 飞书配置项（无需修改） ======================
APP_ID = "cli_a9d5811ad8b89cb5"
APP_SECRET = "Z8FCace8y1gWdEbFN9ARGeH6Aijx0fI3"
ENCRYPT_KEY = "xoN28Vn6yjsB5Kzx1MF9u8oIPNPvYyfE"
VERIFICATION_TOKEN = "h4MHHK8SNO5sBxUT0JC32b5ao4bR7His"

APP_TOKEN = "ETbFbDz36adFvmsYe0IcRkU3nId"
TABLE_ID = "tblUMI69DXHKNTYv"
# ===================================================================


def clean_expired_message_ids():
    """定期清理过期的已处理消息ID"""
    now = time.time()
    expired_ids = [mid for mid, ts in PROCESSED_MESSAGE_IDS.items() if now - ts > DUPLICATE_EXPIRE_SECONDS]
    for mid in expired_ids:
        del PROCESSED_MESSAGE_IDS[mid]
    if expired_ids:
        print(f"ℹ️ 清理过期消息ID：{len(expired_ids)}个")


def extract_url_from_text(text: str) -> str:
    """提取文本中的URL并清理特殊字符"""
    url_pattern = r'https?://[^\s]+'
    urls = re.findall(url_pattern, text)
    return urls[0].rstrip('"\',` ') if urls else ""


def filter_url_params(url: str) -> str:
    """过滤URL的查询参数，只保留协议+域名+路径"""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    except Exception:
        return url


def judge_platform(url: str) -> str:
    """根据URL域名判断所属平台"""
    if not url:
        return "未知"
    url_lower = url.lower()
    if any(d in url_lower for d in ["m.toutiao.com", "toutiao.com", "toutiao"]):
        return "头条"
    elif any(d in url_lower for d in ["baidu.com", "mbd.baidu.com"]):
        return "百家"
    return "未知"


def get_user_info(open_id: str) -> tuple:
    """调用飞书API获取用户名（仅调用一次）"""
    if not open_id:
        return "未知用户", ""

    # 新版本客户端builder模式
    client = lark.Client.builder()\
        .app_id(APP_ID)\
        .app_secret(APP_SECRET)\
        .build()

    try:
        req = GetUserRequest.builder()\
            .user_id(open_id)\
            .user_id_type("open_id")\
            .build()
        resp = client.contact.v3.user.get(req)

        if resp.success() and resp.data and resp.data.user:
            user_name = resp.data.user.name or "未知用户"
            print(f"✅ 获取用户信息成功：姓名={user_name}, open_id={open_id}")
            return user_name, open_id
        print(f"❌ 获取用户名失败：code={resp.code}, msg={resp.msg}")
        return "未知用户", open_id
    except Exception as e:
        print(f"❌ 获取用户信息异常：{str(e)}")
        traceback.print_exc()
        return "未知用户", open_id


def add_data_to_base(url: str, platform: str, open_id: str, user_name: str) -> bool:
    """写入飞书多维表格（适配文本+创建人字段），返回是否写入成功"""
    if not url or platform == "未知" or not open_id:
        print("⚠️ 必要参数缺失，跳过写入")
        return False

    client = lark.Client.builder()\
        .app_id(APP_ID)\
        .app_secret(APP_SECRET)\
        .build()

    try:
        # 构造请求体：url=文本，平台=文本，分享人=创建人（open_id格式）
        req_body = {
            "fields": {
                "url": url,
                "平台": platform,
                "分享人": {
                    "id": open_id,
                    "type": "open_id"
                }
            }
        }

        req = CreateAppTableRecordRequest.builder()\
            .app_token(APP_TOKEN)\
            .table_id(TABLE_ID)\
            .request_body(req_body)\
            .build()

        resp = client.bitable.v1.app_table_record.create(req)
        if resp.success():
            print(f"✅ 写入多维表格成功：URL={url}, 平台={platform}, 分享人={user_name}")
            return True
        else:
            print(f"❌ 写入失败：code={resp.code}, msg={resp.msg}")
            if resp.code == 1254045:
                print(f"⚠️ 排查：表格字段名是否为 url/平台/分享人")
            return False
    except Exception as e:
        print(f"❌ 写入表格异常：{str(e)}")
        traceback.print_exc()
        return False


def do_p2_card_action_trigger(data: P2CardActionTrigger) -> P2CardActionTriggerResponse:
    """处理卡片按钮点击回调（支持 mark_processed 操作）"""
    try:
        action = data.event.action
        operator_open_id = data.event.operator.open_id if data.event and data.event.operator else None
        val = action.value if action and hasattr(action, 'value') else {}
        print(f"ℹ️ 收到卡片交互，action.value={val}")

        if isinstance(val, dict) and val.get('action') == 'mark_processed':
            url = val.get('url', '')
            content = {
                "toast": {"type": "success", "content": "已标记为已处理", "i18n": {"zh_cn": "已标记为已处理"}},
                "card": {
                    "config": {"wide_screen_mode": True},
                    "header": {"title": {"tag": "plain_text", "content": "已处理"}, "template": "grey"},
                    "elements": [
                        {"tag": "div", "text": {"tag": "lark_md", "content": f"✅ 已标记为已处理\n链接：{url}"}}
                    ],
                },
            }
            return P2CardActionTriggerResponse(content)

        # 未识别的交互，返回空响应（不修改卡片，但可返回 toast）
        return P2CardActionTriggerResponse({})

    except Exception as e:
        print(f"❌ 处理卡片交互异常：{e}")
        traceback.print_exc()
        return P2CardActionTriggerResponse({})


def do_p2_im_message_receive_v1(data: P2ImMessageReceiveV1) -> lark.BaseResponse:
    """
    新版本事件处理核心函数
    返回标准BaseResponse，飞书收到后直接停止重试
    """
    # ========== 1. 前置去重：优先判断+清理过期ID ==========
    clean_expired_message_ids()
    message_id = data.event.message.message_id

    if message_id in PROCESSED_MESSAGE_IDS:
        print(f"ℹ️ 消息ID {message_id} 已处理，跳过")
        return lark.BaseResponse({"code": 0, "msg": "success"})

    PROCESSED_MESSAGE_IDS[message_id] = time.time()
    # ======================================================

    res_content = ""
    wrote_to_base = False
    try:
        # 2. 提取发送者信息+获取用户名（仅一次）
        sender = data.event.sender
        open_id = sender.sender_id.open_id if (sender and sender.sender_id) else ""
        user_name, _ = get_user_info(open_id)

        # 3. 解析消息内容
        msg_type = data.event.message.message_type
        content = json.loads(data.event.message.content)
        extracted_url = ""
        platform = "未知"

        if msg_type == "interactive":
            # 处理卡片消息或卡片交互回调（按钮点击）
            # 某些交互回调的 payload 可能在 content 的 'action' / 'actions' / 'value' 字段中
            # 优先识别交互回调
            action_payload = None
            if 'action' in content:
                action_payload = content.get('action')
            elif 'actions' in content:
                action_payload = content.get('actions')
            elif 'value' in content:
                action_payload = content.get('value')

            if action_payload:
                # 解析可能为字符串的 payload
                parsed_payload = None
                try:
                    if isinstance(action_payload, str):
                        parsed_payload = json.loads(action_payload)
                    else:
                        parsed_payload = action_payload
                except Exception:
                    parsed_payload = action_payload

                # 支持一个简单动作：{"action":"mark_processed","url":"..."}
                if isinstance(parsed_payload, dict) and parsed_payload.get('action') == 'mark_processed':
                    res_content = f"✅ 操作已执行：标记为已处理\n链接：{parsed_payload.get('url','')}"
                    print(f"ℹ️ 收到标记处理交互，payload={parsed_payload}")
                else:
                    res_content = f"✅ 已收到卡片交互，payload={parsed_payload}"
                    print(f"ℹ️ 收到未识别的交互，payload={parsed_payload}")

            else:
                # 原始卡片消息（带 card_link）
                card_link = content.get("card_link", {})
                extracted_url = card_link.get("url", "")
                if extracted_url:
                    filtered_url = filter_url_params(extracted_url)
                    platform = judge_platform(filtered_url)
                    res_content = f"✅ 卡片消息处理完成\n原始链接：{extracted_url}\n过滤后：{filtered_url}\n平台：{platform}\n分享人：{user_name}"
                    wrote_to_base = add_data_to_base(filtered_url, platform, open_id, user_name)
                else:
                    res_content = "⚠️ 卡片消息无有效链接"
        elif msg_type == "text":
            # 处理文本消息
            text = content.get("text", "")
            extracted_url = extract_url_from_text(text)
            if extracted_url:
                filtered_url = filter_url_params(extracted_url)
                platform = judge_platform(filtered_url)
                res_content = f"✅ 文本消息处理完成\n提取链接：{extracted_url}\n过滤后：{filtered_url}\n平台：{platform}\n分享人：{user_name}"
                wrote_to_base = add_data_to_base(filtered_url, platform, open_id, user_name)
            else:
                res_content = "⚠️ 文本消息无有效URL"
        else:
            res_content = f"⚠️ 暂不支持 {msg_type} 类型消息"

        # 4. 发送回复消息
        client = lark.Client.builder()\
            .app_id(APP_ID)\
            .app_secret(APP_SECRET)\
            .build()

        # 使用用户提供的 2.0 schema 卡片模板
        card = {
            "schema": "2.0",
            "config": {
                "update_multi": True,
                "style": {
                    "text_size": {
                        "normal_v2": {
                            "default": "normal",
                            "pc": "normal",
                            "mobile": "heading",
                        }
                    }
                },
            },
            "body": {
                "direction": "vertical",
                "horizontal_spacing": "8px",
                "vertical_spacing": "8px",
                "horizontal_align": "left",
                "vertical_align": "top",
                "padding": "0px 0px 12px 0px",
                "elements": [
                    {
                        "tag": "interactive_container",
                        "width": "fill",
                        "height": "auto",
                        "corner_radius": "",
                        "elements": [
                            {
                                "tag": "div",
                                "text": {
                                    "tag": "plain_text",
                                    "content": "处理成功",
                                    "text_size": "heading",
                                    "text_align": "left",
                                    "text_color": "green",
                                },
                                "icon": {
                                    "tag": "standard_icon",
                                    "token": "chat-done_outlined",
                                    "color": "green",
                                },
                                "margin": "4px 0px 4px 12px",
                                "element_id": "Top_title",
                            }
                        ],
                        "has_border": False,
                        "background_style": "green-100",
                        "behaviors": [
                            {"type": "template_open_url", "multi_url": filtered_url}
                        ],
                        "padding": "0px 4px 0px 4px",
                        "direction": "vertical",
                        "horizontal_spacing": "8px",
                        "vertical_spacing": "4px",
                        "horizontal_align": "left",
                        "vertical_align": "top",
                        "margin": "0px 0px 0px 0px",
                        "hover_tips": {"tag": "plain_text", "content": "点击打开分享内容"},
                    },
                    {
                        "tag": "markdown",
                        "content": (
                            f"<person id='{open_id}' show_name=true show_avatar=true style='capsule'></person>"
                            f"<link icon='chat_outlined' url='{filtered_url}' pc_url='' ios_url='' android_url=''>带图标的链接</link>"
                        ),
                        "text_align": "left",
                        "text_size": "normal_v2",
                        "margin": "4px 0px 0px 12px",
                    },
                    {"tag": "div", "text": {"tag": "plain_text", "content": f"实例: {INSTANCE_ID[:8]}"}},
                ],
            },
        }

        # 发送时直接传入完整 card 对象（schema 2.0）
        content = json.dumps(card)
        if data.event.message.chat_type == "p2p":
            # 对私聊使用 open_id 发送，兼容 Lark OpenAPI 的推荐方式
            request = CreateMessageRequest.builder()\
                .receive_id_type("open_id")\
                .request_body(CreateMessageRequestBody.builder()
                             .receive_id(open_id)
                             .msg_type("interactive")
                             .content(content)
                             .build())\
                .build()
            resp = client.im.v1.message.create(request)
            if getattr(resp, 'success', None) and resp.success():
                print("✅ 已发送卡片回复（私聊）")
            else:
                print(f"❌ 发送卡片（私聊）返回错误: code={getattr(resp,'code',None)}, msg={getattr(resp,'msg',None)}")
        else:
            request = ReplyMessageRequest.builder()\
                .message_id(message_id)\
                .request_body(ReplyMessageRequestBody.builder()
                             .content(content)
                             .msg_type("interactive")
                             .build())\
                .build()
            resp = client.im.v1.message.reply(request)
            if getattr(resp, 'success', None) and resp.success():
                print("✅ 已发送卡片回复（群聊）")
            else:
                print(f"❌ 发送卡片（群聊）返回错误: code={getattr(resp,'code',None)}, msg={getattr(resp,'msg',None)}")

        # ========== 核心：返回标准成功响应 ==========
        return lark.BaseResponse({"code": 0, "msg": "success"})

    except Exception as e:
        # 记录异常并打印实例ID以便追踪是哪个部署实例触发的错误
        print(f"❌ 事件处理异常（实例 {INSTANCE_ID[:8]}）：{str(e)}")
        traceback.print_exc()
        # 若未成功写入表格，则删除已注册的消息ID，允许后续重试；若已写入则保留ID，避免重复写入
        if message_id in PROCESSED_MESSAGE_IDS:
            if not wrote_to_base:
                del PROCESSED_MESSAGE_IDS[message_id]
            else:
                print(f"ℹ️ 写入已成功，保留消息ID {message_id} 以防重复写入（实例 {INSTANCE_ID[:8]}）")

        # 不再把完整异常文本直接发送给用户，改为发送简短提示 + 实例ID，便于排查
        error_msg = f"❌ 处理消息出错（实例 {INSTANCE_ID[:8]}），请联系管理员。"
        print(error_msg)
        # 尝试发送简短错误提示（私聊用 open_id）
        try:
            if data.event.message.chat_type == "p2p" and open_id:
                client = lark.Client.builder()\
                    .app_id(APP_ID)\
                    .app_secret(APP_SECRET)\
                    .build()
                error_content = json.dumps({"text": error_msg})
                request = CreateMessageRequest.builder()\
                    .receive_id_type("open_id")\
                    .request_body(CreateMessageRequestBody.builder()
                                 .receive_id(open_id)
                                 .msg_type("text")
                                 .content(error_content)
                                 .build())\
                    .build()
                client.im.v1.message.create(request)
        except Exception:
            # 发送失败不影响主流程（只是告知管理员）
            pass

        # 异常也返回成功响应，防止飞书重试
        return lark.BaseResponse({"code": 0, "msg": "success"})


def main():
    """新版本主函数：标准builder模式初始化所有组件"""
    print("🚀 飞书消息处理服务启动（lark-oapi >=1.5.2 适配版）")
    print(f"📋 多维表格配置：APP_TOKEN={APP_TOKEN}, TABLE_ID={TABLE_ID}")
    print(f"🔢 实例ID：{INSTANCE_ID}")

    # 1. 初始化事件处理器（兼容 lark-oapi builder 接口）
    event_handler = lark.EventDispatcherHandler.builder(ENCRYPT_KEY, VERIFICATION_TOKEN)\
        .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1)\
        .register_p2_card_action_trigger(do_p2_card_action_trigger)\
        .build()

    # 2. 初始化WS客户端（兼容当前 lark-oapi 接口）
    ws_client = lark.ws.Client(
        APP_ID,
        APP_SECRET,
        event_handler=event_handler,
        log_level=lark.LogLevel.DEBUG,
    )

    # 3. 启动WS连接
    ws_client.start()


if __name__ == "__main__":
    main()