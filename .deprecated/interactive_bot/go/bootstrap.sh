#!/bin/bash

export GOPROXY=https://mirrors.aliyun.com/goproxy/
export GO111MODULE=on

go env GOPROXY
# 检查 Go 是否已安装 / Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "当前设备未安装Go语言环境, 请安装后重试。/ Go not installed, please install Go before retrying."
    echo "可参考 ./go-setup.md 安装Go语言环境。/ Refer to./go-setup.md for Go installation instructions."
    exit 1
else
    echo "Go 已安装，版本: $(go version) / Go is already installed, version: $(go version)"
fi


# 安装项目依赖 / Install project dependencies
if [ -f "go.mod" ]; then
    echo "开始安装项目依赖... / Installing project dependencies..."
    go mod tidy
else
    echo "未找到 go.mod 文件，跳过依赖安装。/ No go.mod file found, skipping dependency installation."
fi


# 启动项目 / Start the project
echo "启动项目... / Starting the project..."
go run main.go
