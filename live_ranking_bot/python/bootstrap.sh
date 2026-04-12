#!/bin/bash

if ! command -v python3 &>/dev/null; then
    echo "当前设备未安装Python, 请安装后重试。/ Python not installed, please install Python before retrying."
    echo "可参考./python-setup.md 安装Python。/ Please refer to ./python-setup.md to install Python."
    exit 1
else
    echo "Python 已安装，版本: $(python3 --version) / Python is already installed, version: $(python3 --version)"
fi

if ! command -v pip3 &>/dev/null; then
    echo "pip 未安装，开始安装 pip... / pip not installed, starting pip installation..."
    python3 -m ensurepip --upgrade
    if ! command -v pip3 &>/dev/null; then
        echo "pip 安装失败，请检查问题。/ pip installation failed, please check the issue."
        exit 1
    fi
else
    echo "pip 已安装，版本: $(pip3 --version) / pip is already installed, version: $(pip3 --version)"
fi

if [ -f "requirements.txt" ]; then
    echo "开始安装项目依赖... / Installing project dependencies..."
    pip3 install -r requirements.txt
else
    echo "未找到 requirements.txt 文件，跳过依赖安装。/ No requirements.txt file found, skipping dependency installation."
fi

echo "启动项目... / Starting the project..."
python3 main.py
