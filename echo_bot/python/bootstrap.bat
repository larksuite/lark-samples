@echo off

REM 检查 Python 是否已安装 / Check if Python is installed
where python >nul 2>nul
IF ERRORLEVEL 1 (
    echo "当前设备未安装Python, 请安装后重试。/ Python not installed, please install Python before retrying."
    echo "可参考./python-setup.md 安装Python。/ Please refer to./Python-setup.md to install Python."
    pause
    EXIT /b 1
) ELSE (
    echo Python 已安装，版本信息:  / Python is already installed, version info:
    python --version
)
    

REM 检查 pip 是否已安装 / Check if pip is installed
python -m pip --version >nul 2>nul
IF ERRORLEVEL 1 (
    echo pip 未安装，开始安装 pip... / pip not installed, starting pip installation...
    python -m ensurepip --upgrade
    IF ERRORLEVEL 1 (
        echo pip 安装失败，请检查问题。 / pip installation failed, please check the issue.
        pause
        EXIT /b 1
    )
) ELSE (
    echo pip 已安装，版本信息:  / pip is already installed, version info: 
    call python -m pip --version
)


REM 安装项目依赖 / Install project dependencies
IF EXIST "requirements.txt" (
    echo 开始安装项目依赖... / Installing project dependencies...
    python -m pip install -r requirements.txt
    IF ERRORLEVEL 1 (
        echo 依赖安装失败，请手动检查问题。 / Dependency installation failed, please check manually.
        pause
        EXIT /b 1
    )
) ELSE (
    echo 未检测到 requirements.txt 文件，跳过依赖安装。 / No requirements.txt file detected, skipping dependency installation.
)
    

REM 启动项目 / Start the project
echo 启动项目... / Starting the project...
python main.py
