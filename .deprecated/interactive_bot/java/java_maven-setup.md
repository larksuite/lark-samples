** 这份文档将指导您完成 Java 和 Maven 的安装 **

# 以下为具体安装步骤

## Windows

### 安装 OpenJDK

1. **下载 OpenJDK**：

   - 访问[java.net](https://jdk.java.net/23/)下载 OpenJDK。
   - 选择 Windows / x64 版本。

2. **安装 OpenJDK**：

   - 下载完成后，将文件解压到您选择的目录（例如：`C:\Program Files\AdoptOpenJDK`）。

3. **配置环境变量**：

   - 打开“系统属性”对话框，点击“高级系统设置”。
   - 在“系统属性”窗口中，点击“环境变量”按钮。
   - 在“系统变量”区域，找到“Path”变量，点击“编辑”。
   - 点击“新建”，添加 OpenJDK 安装目录下的`bin`目录路径（例如：`C:\Program Files\AdoptOpenJDK\jdk-23.0.1-hotspot-x64-msvc-19\bin`）。
   - 也可以添加`JAVA_HOME`环境变量，变量值为 OpenJDK 的安装目录（例如：`C:\Program Files\AdoptOpenJDK\jdk-23.0.1-hotspot-x64-msvc-19`）。

4. **验证安装**：
   - 打开新的命令提示符（CMD），输入`java -version`和`javac -version`，如果安装成功，会显示相应的版本信息。

### 安装 Maven

1. **下载 Maven**：

   - 访问[Maven 官网](https://maven.apache.org/download.cgi)或[清华开源镜像](https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/3.9.9/binaries/)下载最新版本的 Maven。
   - 选择下载.zip 格式的压缩包。

2. **解压 Maven**：

   - 将下载的 Maven 压缩包解压到您选择的目录（例如：`C:\Program Files\apache-maven-3.9.9`）。

3. **配置环境变量**：

   - 打开“系统属性”对话框，点击“环境变量”按钮。
   - 在“系统变量”区域，找到“Path”变量，点击“编辑”。
   - 点击“新建”，添加 Maven 的`bin`目录路径（例如：`C:\Program Files\apache-maven-3.9.9\bin`）。

4. **验证安装**：
   - 打开新的命令提示符（CMD），输入`mvn -v`，如果安装成功，会显示 Maven 的版本信息以及 Java 和 OS 的信息。

## macOS

在 macOS 上安装 OpenJDK 和 Maven 可以通过几种不同的方法，包括使用 Homebrew、手动下载安装包以及使用 Docker。本教程仅介绍使用 Homebrew 安装这两种工具的步骤，因为 Homebrew 是 macOS 上最常用的包管理器，可以简化安装过程。

### 安装 Homebrew

首先，检查您是否已安装 HomeBrew

```bash
brew -v
```

如果出现 Homebrew 版本信息，则表示您已安装 Homebrew，可以跳过安装此步骤；
如您还没有安装 Homebrew，可以通过在终端运行以下命令来安装：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 安装 OpenJDK

安装 Homebrew 后，您可以使用它来安装 OpenJDK。打开终端并运行以下命令：

```bash
brew install java
```

这个命令会安装最新的 OpenJDK 版本。您可以通过运行`java -version`来检查安装是否成功。

### 安装 Maven

同样地，使用 Homebrew 来安装 Maven：

```bash
brew install maven
```

安装完成后，您可以通过运行`mvn -v`来检查 Maven 是否安装成功。

### 配置环境变量

如果您需要将 Java 和 Maven 的路径添加到您的环境变量中，您可以在您的`~/.bash_profile`、`~/.bashrc`、`~/.zshrc`或其他 shell 配置文件中添加以下行：

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11) # 假设您安装的是Java 11
export PATH=$JAVA_HOME/bin:$PATH
export PATH=/usr/local/opt/maven/bin:$PATH
```

请根据您安装的 Java 版本调整`JAVA_HOME`中的版本号。然后，运行`source ~/.zshrc`（或对应的配置文件）来使更改生效。

### 验证安装

安装完成后，您可以通过以下命令来验证安装：

- 对于 Java：

```bash
java -version
```

- 对于 Maven：

```bash
mvn -v
```

## Linux

以下为基于 Debian 的系统的 linux 上安装 OpenJDK 和 Maven 的步骤：

### 安装 OpenJDK

1. **更新系统软件包列表**：

```bash
sudo apt update
```

2. **安装 OpenJDK**：
您可以选择安装不同版本的 OpenJDK，例如安装 OpenJDK 23 的命令如下：

```bash
sudo apt install openjdk-23-jdk
```

3. **验证 OpenJDK 安装**：
安装完成后，使用以下命令验证 OpenJDK 的安装：
```bash
java -version
```
如果输出显示 Java 版本信息，则表示安装成功。

### 安装 Maven

1. **使用 apt 安装 Maven**：
通过软件包管理工具`apt`安装 Maven 非常简单：

```bash
sudo apt install maven
```

安装完成后，Maven 会被安装在`/usr/share/maven`目录下。

2. **验证 Maven 安装**：
使用以下命令验证 Maven 是否安装成功：
```bash
mvn -version
```
您应该会看到 Maven 的版本信息，包括 Java 版本和 Maven 的安装路径等。

### 配置环境变量（可选）

如果需要将 Java 和 Maven 的路径添加到环境变量中，可以编辑`/etc/environment`文件，添加以下内容（假设您安装的是 OpenJDK 11）：

```bash
JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
PATH="$PATH:$JAVA_HOME/bin"
```

保存文件并关闭编辑器后，执行以下命令使环境变量生效：

```bash
source /etc/environment
```

然后，您可以使用`echo $JAVA_HOME`来验证环境变量是否配置成功。
