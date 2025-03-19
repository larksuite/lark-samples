# 审批机器人

## 效果说明

- 用户每次进入机器人单聊，机器人自动发送审批通知卡片
- 机器人单聊配置悬浮/机器人菜单：发布通知（可选）
- 点击选出菜单按钮后，用户上屏消息，点击发布通知，就会以用户身份自动发一条消息，然后机器人回复发送一个审批通知卡片
- 用户点击审批通卡片的按钮，卡片自动更新成审批通过卡片

## 启动项目

macOS/Linux： `APPROVING_CARD_ID=<审批卡片ID> APPROVED_CARD_ID=<审批通过卡片ID> APP_ID=<应用ID> APP_SECRET=<应用Secret> ./bootstrap.sh`

Windows： `set APPROVING_CARD_ID=<审批卡片ID>&set APPROVED_CARD_ID=<审批通过卡片ID>&set APP_ID=<应用ID>&APP_SECRET=<应用Secret>&bootstrap.bat`
