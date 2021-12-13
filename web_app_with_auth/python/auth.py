import requests
import logging
from urllib import parse
from flask import redirect, request

# const
# open api capability
AUTH_URI = "/open-apis/authen/v1/index"
USER_ACCESS_TOKEN_URI = "/open-apis/authen/v1/access_token"
APP_ACCESS_TOKEN_URI = "/open-apis/auth/v3/app_access_token/internal"
USER_INFO_URI = "/open-apis/authen/v1/user_info"


class Auth(object):
    def __init__(self, lark_host, app_id, app_secret):
        self.lark_host = lark_host
        self.app_id = app_id
        self.app_secret = app_secret
        self._app_access_token = ""
        self._user_access_token = ""

    @property
    def user_access_token(self):
        return self._user_access_token

    @property
    def app_access_token(self):
        return self._app_access_token

    def authorize_user_access_token(self):
        # get user_access_token, implemented based on Feishu open api capability. doc link: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authen/access_token
        self.authorize_app_access_token()
        code = request.args.get("code")
        url = self._gen_url(USER_ACCESS_TOKEN_URI)
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + self.app_access_token,
        }
        req_body = {"grant_type": "authorization_code", "code": code}
        response = requests.post(url=url, headers=headers, json=req_body)
        Auth._check_error_response(response)

        self._user_access_token = response.json().get("data").get("access_token")

    def redirect(self, redirect_url):
        # redirect to return authorization code, implemented based on Feishu open api capability. doc link: https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/get-
        args = {"app_id": self.app_id, "redirect_uri": redirect_url}
        # authorization url
        redirect_auth_url = Auth._build_url_with_query_params(
            self._gen_url(AUTH_URI), args
        )
        return redirect(redirect_auth_url)

    def get_user_info(self):
        # get user info, implemented based on Feishu open api capability. doc link: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authen/user_info
        url = self._gen_url(USER_INFO_URI)
        headers = {
            "Authorization": "Bearer " + self.user_access_token,
            "Content-Type": "application/json",
        }
        response = requests.get(url=url, headers=headers)
        Auth._check_error_response(response)
        return response.json().get("data")

    def authorize_app_access_token(self):
        # get app_access_token, implemented based on Feishu open api capability. doc link: https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/app_access_token_internal
        url = self._gen_url(APP_ACCESS_TOKEN_URI)
        req_body = {"app_id": self.app_id, "app_secret": self.app_secret}
        response = requests.post(url, req_body)
        Auth._check_error_response(response)
        self._app_access_token = response.json().get("app_access_token")

    def _gen_url(self, uri):
        return "{}{}".format(self.lark_host, uri)

    @staticmethod
    def _build_url_with_query_params(base_url, args_dict):
        # build url with query
        return "{}?{}".format(base_url, parse.urlencode(args_dict))

    @staticmethod
    def _check_error_response(resp):
        # check if the response contains error information
        if resp.status_code != 200:
            raise resp.raise_for_status()
        response_dict = resp.json()
        code = response_dict.get("code", -1)
        if code != 0:
            logging.error(response_dict)
            raise LarkException(code=code, msg=response_dict.get("msg"))


class LarkException(Exception):
    def __init__(self, code=0, msg=None):
        self.code = code
        self.msg = msg

    def __str__(self) -> str:
        return "{}:{}".format(self.code, self.msg)

    __repr__ = __str__
