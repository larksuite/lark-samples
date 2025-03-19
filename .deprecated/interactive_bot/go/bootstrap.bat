@echo off

set GOPROXY=https://mirrors.aliyun.com/goproxy/ 
set GO111MODULE=on

REM 检查 Go 是否已安装 / Check if Go is installed

where go >nul 2>nul
IF ERRORLEVEL 1 (
    echo 当前设备未安装Go语言环境, 请安装后重试。/ The current device is not installed with Go language environment, please install it and try again.
    echo 可参考 ./go-setup.md 安装Go语言环境。/ Refer to./go-setup.md for Go installation instructions.
    pause
    EXIT /b 1
) ELSE (
    echo Go 已安装，版本:  / Go is already installed, version: 
    call go version
)

REM 安装项目依赖 / Install project dependencies
IF EXIST "go.mod" (
    echo 开始安装项目依赖... / Installing project dependencies...
    call go mod tidy
) ELSE (
    echo 未找到 go.mod 文件，跳过依赖安装。/ No go.mod file found, skipping dependency installation.
    pause
    EXIT /b 1
)

echo 启动项目... / Starting the project...
go run main.go

