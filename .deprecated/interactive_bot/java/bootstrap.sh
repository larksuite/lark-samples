#!/bin/bash

# 检查 Java 是否已安装 / Check if Java is installed
javaV=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
if [ -z "$javaV" ]; then
    echo "当前设备未安装Java jdk, 请安装后重试。/ Java is not installed. Please install it to continue."
    echo "可参考 ./java_maven-setup.md 安装java环境。/ Please refer to./java_maven-setup.md to install java environment."
    exit 1
else
    javaVersion=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
    echo "Java 已安装，版本: $javaVersion / Java is already installed, version: $javaVersion"
fi

# 检查 Maven 是否已安装 / Check if Maven is installed
if ! [ -x "$(command -v mvn)" ]; then
    echo "当前设备未安装Maven, 请安装后重试。/ Maven is not installed. Please install it to continue."
    echo "可参考 ./java_maven-setup.md 安装java环境。/ Please refer to./java_maven-setup.md to install java environment."
    exit 1
else
    mvnVersion=$(mvn -v | grep 'Apache Maven' | awk '{print $3}')
    # 安装成功
    echo "Maven 安装完成，版本: $mvnVersion / Maven is already installed, version: $mvnVersion"
fi

# 安装项目依赖 / Install project dependencies
if [ -f "pom.xml" ]; then
    echo "开始安装项目依赖... / Installing project dependencies..."
    mvn install
else
    echo "未找到 pom.xml 文件，跳过依赖安装。/ No pom.xml file found, skipping dependency installation."
fi

# 启动项目 / Start the project
echo "启动项目... / Starting the project..."
mvn exec:java
