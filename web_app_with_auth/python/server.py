#!/usr/bin/env python
# -*- coding: UTF-8 -*-
import os

from auth import Auth
from functools import wraps
from dotenv import load_dotenv, find_dotenv
from flask import Flask, redirect, render_template, session, jsonify

# const
# session key
USER_INFO_KEY = "UserInfo"
# secret_key is necessary for flask session capability
SECRET_KEY = "ThisIsSecretKey"

# load env parameters form file named .env
load_dotenv(find_dotenv())

# init flask app
app = Flask(__name__, static_url_path="/public", static_folder="./public")
app.secret_key = SECRET_KEY
app.debug = True

# get env
APP_ID = os.getenv("APP_ID")
APP_SECRET = os.getenv("APP_SECRET")
CALLBACK_URL = os.getenv("CALLBACK_URL")
LARK_HOST = os.getenv("LARK_HOST")

# init auth
auth = Auth(LARK_HOST, APP_ID, APP_SECRET)


class Biz(object):
    # business handle
    @staticmethod
    def home_handler():
        return Biz._show_user_info()

    @staticmethod
    def login_succeed_handler():
        return Biz._show_user_info()

    @staticmethod
    def login_failed_handler(err_info):
        return Biz._show_err_info(err_info)

    @staticmethod
    def _show_user_info():
        return render_template("index.html", user_info=session[USER_INFO_KEY])

    @staticmethod
    def _show_err_info(err_info):
        return render_template("err_info.html", err_info=err_info)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if USER_INFO_KEY not in session:
            return redirect("/login")
        return f(*args, **kwargs)

    return decorated


@app.errorhandler(Exception)
def auth_error_handler(ex):
    return Biz.login_failed_handler(ex)


@app.route("/", methods=["GET"])
@login_required
def get_home():
    return Biz.home_handler()


@app.route("/login", methods=["GET"])
def login():
    return auth.redirect(redirect_url=CALLBACK_URL)


@app.route("/callback", methods=["GET"])
def callback_handler():
    # get user info
    auth.authorize_user_access_token()
    user_info = auth.get_user_info()
    session[USER_INFO_KEY] = user_info
    return Biz.login_succeed_handler()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
