** 这份文档将指导您完成 Nodejs 的安装 **

# 以下为具体安装步骤

## Windows

### 下载 Node.js 安装包

- 访问 Node.js 的官方网站：[Node.js 官网](https://nodejs.org/zh-cn/download/package-manager) 或 [清华源镜像](https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/)
- 选择 LTS（长期支持版）下载【官网】； 选择.msi 后缀的格式的文件下载（如：node-v20.18.1-x64.msi）【镜像】。

### 运行安装程序

- 双击下载的`.msi`文件启动安装程序。
- 按照安装向导的指示进行安装。在安装过程中，你可以选择“Add to PATH”（添加到环境变量）的选项，这样可以在任何命令行窗口中直接使用`node`和`npm`命令。

### 验证安装

- 安装完成后，打开命令提示符（CMD）或 PowerShell。
- 输入`node -v`来检查 Node.js 的版本，确保安装成功。
- 输入`npm -v`来检查 npm（Node.js 的包管理器）的版本。

## macOS

### 下载 Node.js 安装包

- 访问 Node.js 的官方网站：[Node.js 官网](https://nodejs.org/zh-cn/download/package-manager) 或 [清华源镜像](https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/)
- 选择适合你的 macOS 系统的 LTS 版本，下载`.pkg`安装包。

### 运行安装程序

- 双击下载的`.pkg`文件启动安装程序。
- 按照安装向导的指示进行安装。

### 验证安装

- 安装完成后，打开终端。
- 输入`node -v`来检查 Node.js 的版本，确保安装成功。
- 输入`npm -v`来检查 npm（Node.js 的包管理器）的版本。

## Linux

以下为基于 Debian 的系统的 linux 上安装 Nodejs 语言环境 的步骤：

### 1. 更新系统包

打开终端，执行以下命令：

```bash
sudo apt update
```

### 2. 安装 Node.js 和 npm

接下来，你可以直接使用`apt`来安装 Node.js 和 npm。执行以下命令：

```bash
sudo apt install -y nodejs npm
```

### 3. 验证安装

安装完成后，你可以通过以下命令来验证安装是否成功：

```bash
node -v
```

```bash
npm -v
```
