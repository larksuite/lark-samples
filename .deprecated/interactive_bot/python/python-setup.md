**这份文档将指导您完成 Python 环境的安装**

# 以下为具体安装步骤

## Windows

### 1. 下载 Python 安装包

- 访问 Python 的官方下载页面：[https://www.python.org/downloads/](https://www.python.org/downloads/)。
- 选择适用于 Windows 的安装包，例如最新版本的`python-3.13.0-amd64.exe`（请替换为您需要的版本号）。
- 点击下载链接，等待下载完成。

### 2. 安装 Python

- 找到下载的安装包，通常位于浏览器的下载目录中。
- 双击安装文件，按照安装向导的指示进行操作：
  - 勾选“Add Python to PATH”（将 Python 添加到环境变量）选项。
  - 点击“Customize installation”（自定义安装），根据需要选择安装组件，默认设置已包含常用组件。
  - 确认安装路径，可以使用默认路径，也可以手动选择安装位置。
  - 点击“Install Now”开始安装。
- 安装完成后，点击“Close”关闭安装向导。

### 3. 校验是否安装成功

- 打开命令提示符（cmd），输入`python --version`，如果输出显示 Python 的版本信息，则表示安装成功。
- 输入`pip --version`可以验证 pip（Python 包管理工具）是否正确安装。

## macOS

### 步骤 1：安装 Homebrew（如果尚未安装）

如果您的 Mac 尚未安装 Homebrew，可以通过以下命令进行安装：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，您可以通过执行`brew --version`来验证 Homebrew 是否安装成功。

### 步骤 2：使用 Homebrew 安装 Python

通过以下命令安装 Python：

```bash
brew install python
```

Homebrew 会自动安装 Python 的最新稳定版本。

### 步骤 3：验证 Python 安装

安装完成后，您可以通过以下命令验证 Python 是否安装成功：

```bash
python3 --version
```

如果输出显示 Python 版本号，则安装成功。

## Linux

以下为基于 Debian 系统在 Linux 上安装 Python 环境的步骤：

### 步骤 1：更新包索引

打开终端，首先更新您的包索引：

```bash
sudo apt update
```

### 步骤 2：安装 Python

使用以下命令安装 Python：

```bash
sudo apt install python3
```

### 步骤 3：验证安装

安装完成后，您可以通过以下命令来验证 Python 是否安装成功：

```bash
python3 --version
```

### 步骤 4：安装 pip

如果需要安装 pip，可以运行以下命令：

```bash
sudo apt install python3-pip
```

然后通过以下命令验证 pip 是否安装成功：

```bash
pip3 --version
```