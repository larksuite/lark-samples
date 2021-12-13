#!/usr/bin/env python
# -*- coding: UTF-8 -*-
import os
import time
import hashlib
import requests
from auth import Auth
from dotenv import load_dotenv, find_dotenv
from flask import Flask, redirect, request, jsonify, render_template

# const
# 随机字符串，用于签名生成加密使用
NONCE_STR = "13oEviLbrTo458A3NjrOwS70oTOXVOAm"

# 加载 .env文件内环境数据
load_dotenv(find_dotenv())

# 初始化 flask app
app = Flask(__name__, static_url_path="/public", static_folder="./public")

# 获取环境变量
APP_ID = os.getenv("APP_ID")
APP_SECRET = os.getenv("APP_SECRET")
LARK_HOST = os.getenv("LARK_HOST")


@app.errorhandler(Exception)
def auth_error_handler(ex):
    response = jsonify(message=str(ex))
    response.status_code = (
        ex.response.status_code if isinstance(ex, requests.HTTPError) else 500
    )
    return response


# 初始化auth服务
auth = Auth(LARK_HOST, APP_ID, APP_SECRET)


@app.route("/", methods=["GET"])
def get_home():
    # 展示主页
    return render_template("index.html")


@app.route("/get_signature", methods=["GET"])
def get_signature():
    # 获取jsapi签名相关数据
    url = request.args.get("url")
    ticket = auth.get_ticket()
    timestamp = str(int(time.time()) * 1000)
    verify_str = "jsapi_ticket={}&noncestr={}&timestamp={}&url={}".format(
        ticket, NONCE_STR, timestamp, url
    )
    return jsonify(
        {
            "appid": APP_ID,
            "ticket": ticket,
            "signature": hashlib.sha1(verify_str.encode("utf-8")).hexdigest(),
            "noncestr": NONCE_STR,
            "timestamp": timestamp,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
