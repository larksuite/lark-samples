# 卡片交互-告警机器人

开发文档：https://open.feishu.cn/document/uAjLw4CM/uMzNwEjLzcDMx4yM3ATM/develop-a-card-interactive-bot/introduction

## 效果说明

- 用户每次进入机器人单聊，机器人自动发送欢迎卡片，可点击发起告警、查看教程说明
- 机器人单聊菜单：发起告警
- 用户点击欢迎卡片中的“发起告警”按钮，或点击机器人菜单中的“发起告警”，或在机器人单聊中发送任何消息，或在群聊中 at 机器人发送任何消息，机器人都会自动发送一个告警卡片
- 用户点击告警卡片中的“已处理”，卡片自动更新成处理完成的卡片

## 启动项目

macOS/Linux： `WELCOME_CARD_ID=<欢迎卡片ID> ALERT_CARD_ID=<告警卡片ID> ALERT_RESOLVED_CARD_ID=<已处理卡片ID> APP_ID=<应用ID> APP_SECRET=<应用Secret> ./bootstrap.sh`

Windows： `set WELCOME_CARD_ID=<欢迎卡片ID>&set ALERT_CARD_ID=<告警卡片ID>&set ALERT_RESOLVED_CARD_ID=<已处理卡片ID>&set APP_ID=<应用ID>&APP_SECRET=<应用Secret>&bootstrap.bat`

## 注意事项

- 请使用 Python3 环境
