# 回声机器人

开发文档：https://open.feishu.cn/document/uAjLw4CM/uMzNwEjLzcDMx4yM3ATM/develop-an-echo-bot/introduction

## 效果

![](./assets/image.png)

- 用户输入纯文本消息，机器人回复：收到你发送的消息：XXXX。
- 用户在群组内 @机器人并发送纯文本消息，机器人引用这条消息并回复：收到你发送的消息：XXXX。

## 启动项目

macOS/Linux： `APP_ID=<app_id> APP_SECRET=<app_secret> ./bootstrap.sh`

Windows： `set APP_ID=<app_id>&set APP_SECRET=<app_secret>&bootstrap.bat`
