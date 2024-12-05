#!/bin/bash

# 函数：检查 Python 是否已安装 / Function: Check if Python is installed
check_python() {
    if ! command -v python3 &>/dev/null; then
        echo "当前设备未安装Python, 请安装后重试。/ Python not installed, please install Python before retrying."
        echo "可参考./python-setup.md 安装Python。/ Please refer to./Python-setup.md to install Python."
        exit 1
    else
        echo "Python 已安装，版本: $(python3 --version) / Python is already installed, version: $(python3 --version)"
    fi
}

# 函数：检查 pip 是否已安装 / Function: Check if pip is installed
check_pip() {
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
}

# 函数：安装项目依赖 / Function: Install project dependencies
install_dependencies() {
    if [ -f "requirements.txt" ]; then
        echo "开始安装项目依赖... / Installing project dependencies..."
        pip3 install -r requirements.txt
    else
        echo "未找到 requirements.txt 文件，跳过依赖安装。/ No requirements.txt file found, skipping dependency installation."
    fi
}

# 函数：启动项目 / Function: Start the project
start_project() {
    echo "启动项目... / Starting the project..."
    python3 main.py
}

# 主逻辑：根据传入的参数执行不同的操作 / Main logic: Perform different operations based on the passed parameters
case "$1" in

start)
    start_project
    ;;
"")
    check_python
    check_pip
    install_dependencies
    start_project
    ;;
*)
    echo "未知命令: $1 / Unknown command: $1"
    echo "使用方法: $0 {start} / Usage: $0 {start}"
    exit 1
    ;;
esac
