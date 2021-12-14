# 快速开发网页应用

如果需要开发一款在飞书客户端内获取已登录用户信息的网页应用，可以参考本示例。本示例使用飞书客户端 jssdk，利用客户端登录态，完成已登录用户信息查询功能。

## 运行环境

- [Python 3](https://www.python.org/)

## 准备工作

1、在[开发者后台](https://open.feishu.cn/app/) 点击**创建企业自建应用**，创建成功之后，点击应用名称打开应用，点击**凭证与基础信息**切换页面，拿到 App ID 和 App Secret 信息。
![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/d78a510b714223322a770703f0a2f02d_r66l7lrTxo.png)

2、点击**网页**切换页面，打开**启用网页**按钮，修改**网页配置**，填写**桌面端主页**和**移动端主页**都为`http://127.0.0.1:3000`即可。
![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/f1d14fc439de15fe9f92de93d06d03bb_C4zmbQlEH2.png)

3、点击**安全设置**，配置 **h5 可信域名**为`http://127.0.0.1:3000`即可。

4、点击**版本管理与发布**，创建版本并发布上线。

- 点击**创建版本**，填写发版必须内容，点击**保存**，完成版本创建。
  ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/1b9423a66074845bb9b139f359ca6980_5wg7ADFBiy.png)
  **注意**：仅可用性范围内用户能够打开应用。
- 点击**申请发布**，应用即时上线生效。

5、拉取最新代码到本地，并进入对应目录

```commandline
git clone https://github.com/larksuite/lark-samples.git
cd lark-samples/web_app_with_jssdk/python
```

6、修改环境值

修改`.env`文件中应用凭证数据为真实数据。

```text
APP_ID=cli_9fxxxx00b
APP_SECRET=EX6xxxxOF
```

以上两个参数可以在[开发者后台](https://open.feishu.cn/app/) 点击**凭证与基础信息查看**。

## docker 运行

运行之前需要确保 [Docker](https://www.docker.com/) 已经安装。docker运行与下方本地运行二选一即可。

**mac/linux**

```commandline
sh exec.sh
```

**windows**

```
.\exec.ps1
```

运行起来之后，只能在飞书内体验，打开**飞书**>**工作台**> 搜索应用名称> 打开应用。

## 本地运行

1、创建并激活一个新的虚拟环境

**mac/linux**

```
python3 -m venv venv
. venv/bin/activate
```

**windows**

```
python3 -m venv venv
venv\Scripts\activate
```

激活后，终端会显示虚拟环境的名称

```
(venv) **** python %
```

2、安装依赖

```
pip install -r requirements.txt
```

3、运行

```
python3 server.py
```

运行起来之后，只能在飞书内体验，打开**飞书**>**工作台**> 搜索应用名称> 打开应用。