import lark_oapi as lark
from lark_oapi.api.im.v1 import *
from lark_oapi.api.bitable.v1 import CreateAppTableRecordRequest
from lark_oapi.api.contact.v3 import *
import json
import re
from urllib.parse import urlparse, urlunparse
import traceback
import time
from typing import Dict

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


def add_data_to_base(url: str, platform: str, open_id: str, user_name: str):
    """写入飞书多维表格（适配文本+创建人字段）"""
    if not url or platform == "未知" or not open_id:
        print("⚠️ 必要参数缺失，跳过写入")
        return

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
        else:
            print(f"❌ 写入失败：code={resp.code}, msg={resp.msg}")
            if resp.code == 1254045:
                print(f"⚠️ 排查：表格字段名是否为 url/平台/分享人")
    except Exception as e:
        print(f"❌ 写入表格异常：{str(e)}")
        traceback.print_exc()


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
        return lark.BaseResponse.builder().code(0).msg("success").build()

    PROCESSED_MESSAGE_IDS[message_id] = time.time()
    # ======================================================

    res_content = ""
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
            # 处理卡片消息
            card_link = content.get("card_link", {})
            extracted_url = card_link.get("url", "")
            if extracted_url:
                filtered_url = filter_url_params(extracted_url)
                platform = judge_platform(filtered_url)
                res_content = f"✅ 卡片消息处理完成\n原始链接：{extracted_url}\n过滤后：{filtered_url}\n平台：{platform}\n分享人：{user_name}"
                add_data_to_base(filtered_url, platform, open_id, user_name)
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
                add_data_to_base(filtered_url, platform, open_id, user_name)
            else:
                res_content = "⚠️ 文本消息无有效URL"
        else:
            res_content = f"⚠️ 暂不支持 {msg_type} 类型消息"

        # 4. 发送回复消息
        client = lark.Client.builder()\
            .app_id(APP_ID)\
            .app_secret(APP_SECRET)\
            .build()

        if data.event.message.chat_type == "p2p":
            reply_req = CreateMessageRequest.builder()\
                .receive_id_type("chat_id")\
                .request_body(CreateMessageRequestBody.builder()
                             .receive_id(data.event.message.chat_id)
                             .msg_type("text")
                             .content(json.dumps({"text": res_content}))
                             .build())\
                .build()
            client.im.v1.message.create(reply_req)
        else:
            reply_req = ReplyMessageRequest.builder()\
                .message_id(message_id)\
                .request_body(ReplyMessageRequestBody.builder()
                             .content(json.dumps({"text": res_content}))
                             .msg_type("text")
                             .build())\
                .build()
            client.im.v1.message.reply(reply_req)

        # ========== 核心：返回标准成功响应 ==========
        return lark.BaseResponse.builder().code(0).msg("success").build()

    except Exception as e:
        print(f"❌ 事件处理异常：{str(e)}")
        traceback.print_exc()
        # 异常时移除ID，避免阻塞后续消息
        if message_id in PROCESSED_MESSAGE_IDS:
            del PROCESSED_MESSAGE_IDS[message_id]
        # 异常也返回成功响应，防止飞书重试
        return lark.BaseResponse.builder().code(0).msg("success").build()


def main():
    """新版本主函数：标准builder模式初始化所有组件"""
    print("🚀 飞书消息处理服务启动（lark-oapi >=1.5.2 适配版）")
    print(f"📋 多维表格配置：APP_TOKEN={APP_TOKEN}, TABLE_ID={TABLE_ID}")

    # 1. 初始化事件处理器（新版本标准写法）
    event_handler = lark.EventDispatcherHandler.builder()\
        .encrypt_key(ENCRYPT_KEY)\
        .verification_token(VERIFICATION_TOKEN)\
        .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1)\
        .build()

    # 2. 初始化WS客户端（新版本builder模式，参数清晰无冲突）
    ws_client = lark.ws.Client.builder()\
        .app_id(APP_ID)\
        .app_secret(APP_SECRET)\
        .event_handler(event_handler)\
        .log_level(lark.LogLevel.DEBUG)\
        .build()

    # 3. 启动WS连接
    ws_client.start()


if __name__ == "__main__":
    main()