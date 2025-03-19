** 这份文档将指导您完成  Go 语言环境的安装 **

# 以下为具体安装步骤

## Windows

### 1. 下载 Go 语言安装包

- 访问 Go 语言的官方下载页面：[https://golang.google.cn/dl/](https://golang.google.cn/dl/)。
- 选择适用于 Windows 的安装包，例如最新版本的`go1.23.3.windows-386.msi`（请替换为您需要的版本号）。
- 点击下载链接，等待下载完成。

### 2. 安装 Go 语言

- 找到下载的安装包，通常位于浏览器的下载目录中。
- 双击安装文件，按照安装向导的指示进行操作：
  - 点击“Next”接受许可协议。
  - 在选择安装路径窗口，可以选择默认安装到`C:\Go`目录，或者修改为其他路径。然后点击“Next”。
  - 在接下来的窗口可以选择安装组件，通常默认全选即可。点击“Next”继续。
  - 最后一个窗口是概要信息，点击“Install”开始安装。
  - 安装完成后，点击“Finish”关闭安装向导。

### 3. 配置环境变量

- 使用 Windows 键+R 组合键打开“运行”窗口，输入`sysdm.cpl`，回车打开系统属性对话框。
- 在“高级”标签页下点击“环境变量”按钮打开环境变量对话框。
- 在“系统变量”中找到`Path`变量，双击编辑，在变量值的最后追加`;C:\Go\bin`（注意路径要换成您的实际 Go 安装路径）。
- 添加`GOROOT`变量，变量值设置为 Go 的安装路径，如`C:\Go`。
- 添加`GOPATH`变量，变量值设置为您的代码工作区路径，如`C:\GoWork`。

### 4. 校验是否配置成功

- 打开新的命令提示符（cmd），输入`go version`，如果输出显示 Go 的版本信息，则表示安装成功。
- 输入`go env`可以查看 Go 的环境变量配置情况。

## macOS

### 步骤 1：安装 Homebrew（如果尚未安装）

如果您的 Mac 尚未安装 Homebrew，可以通过以下命令进行安装：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，您可以通过执行`brew --version`来验证 Homebrew 是否安装成功。

### 步骤 2：使用 Homebrew 安装 Go

在 ARM 架构的 Mac 上，您可以直接使用 Homebrew 来安装 Go，Homebrew 会自动适配 ARM 架构：

```bash
brew install go
```

这个命令会下载并安装适合您 Mac 芯片架构的 Go 版本。

### 步骤 3：验证 Go 安装

安装完成后，您可以通过执行以下命令来验证 Go 是否安装成功：

```bash
go version
```

## Linux

以下为基于 Debian 的系统的 linux 上安装 Go 语言环境 的步骤：

### 步骤 1：更新包索引

打开终端，首先更新您的包索引：

```bash
sudo apt update
```

### 步骤 2：安装 Go

使用`apt`安装 Go：

```bash
sudo apt install golang-go
```

### 步骤 3：验证安装

安装完成后，您可以通过运行以下命令来验证 Go 是否安装成功：

```bash
go version
```
