@echo off

REM 检查是否安装了 nodejs / Check if nodejs is installed
where node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo 当前设备未安装 Nodejs, 请安装后重试。/ Nodejs is not installed on the current device, please install it and try again.
    echo 可参考 ./nodejs-setup.md 安装Nodejs。/ Please refer to./nodejs-setup.md to install Nodejs.
    pause
    EXIT /b 1
) ELSE (
    echo Node.js 已安装，版本信息:  / Node.js is already installed, version info: 
    node -v
)

REM 安装依赖 / Install dependencies
echo 安装项目依赖... / Installing project dependencies...
call npm i

REM 启动项目 / Start the project
echo 启动项目... / Starting the project...
npm run dev
