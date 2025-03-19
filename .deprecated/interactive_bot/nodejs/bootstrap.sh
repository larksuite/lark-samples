#!/bin/bash

# 检查 Nodejs 是否已安装 / Check if Nodejs is installed
if ! command -v node &>/dev/null; then
    echo "当前设备未安装Nodejs, 请安装后重试。/ Nodejs not installed, please install Nodejs before retrying."
    echo "可参考./nodejs-setup.md 安装nodejs。/ Please refer to./nodejs-setup.md to install Nodejs."
    exit 1
else
    echo "Nodejs已安装，版本$(node -v)/ Using Node.js version: $(node -v)"
fi

# 安装项目依赖 / Install project dependencies
echo "安装项目依赖... / Installing project dependencies..."
npm i

# 启动项目 / Start the project
echo "启动项目... / Starting the project..."
npm run dev
