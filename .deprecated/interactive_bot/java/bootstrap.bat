@echo off

REM 检查 Java 是否已安装 / Check if Java is installed
where java >nul 2>nul
IF ERRORLEVEL 1 (
    echo 当前设备未安装Java jdk, 请安装后重试。/ Java is not installed. Please install it to continue.
    echo 可参考 ./java_maven-setup.md 安装java环境。/ Please refer to./java_maven-setup.md to install java environment.
    pause
    EXIT /b 1
) ELSE (
    echo Java 已安装，版本信息:  / Java is already installed, version info: 
    call java -version
)
   

REM 检查 Maven 是否已安装 / Check if Maven is installed
where mvn >nul 2>nul
IF ERRORLEVEL 1 (
    echo 当前设备未安装Maven, 请安装后重试。/ Maven is not installed. Please install it to continue.
    echo 可参考 ./java_maven-setup.md 安装java环境。/ Please refer to./java_maven-setup.md to install java environment.
    pause
    EXIT /b 1
) ELSE (
    echo Maven 安装完成，版本信息: !maven_version! / Maven is already installed, version info:
    call mvn -version
)
   

REM 安装项目依赖 / Install project dependencies
IF EXIST "pom.xml" (
    echo 开始安装项目依赖... / Installing project dependencies...
    call mvn install
) ELSE (
    echo 未找到 pom.xml 文件，跳过依赖安装。/ No pom.xml file found, skipping dependency installation.
    pause
    EXIT /b 1
)
   

REM 启动项目 / Start the project
echo 启动项目... / Starting the project....
mvn exec:java
