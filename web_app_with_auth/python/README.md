# Quickly create a login-free web app

If you need to develop a web app that obtains the information of logged-in Lark users from the browser, you can refer to
this article as an example. As an example about getting started with web app, this article describes how to use the
identity verification capabilities provided by Lark Open Platform to complete the login-free web page of a third party
and obtain logged-in user information

## Runtime environment

- [Python 3](https://www.python.org/)

## Prep work

1. In [Developer Console](https://open.larksuite.com/app) , click **Create custom app**. Once successfully created,
   click the app to open it, and click
   **Credentials & Basic Info**, where you can obtain the App ID and App Secret.
   ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/2176e0e2eb1cec4ec34c31e4e139a783_6SXGgsDy4q.png)

2. Click **Security Settings**. In **Redirect URLs**, configure the redirect URL allowlist
   as `http://127.0.0.1:3000/callback`.
   ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/3f60a293c70c5fb3f83b6de47ef2ad0e_rT3ollqWz8.png)
   **Note**: The redirect URL list configured here is the redirect URL allowlist of the app. If the redirect URL is not
   allowlisted, an error will be reported during login redirection.

3. Click **Web App** switch page and turn on the **Use Web Page** option. Modify the **Web Page Setting** and
   enter `http://127.0.0.1:3000` as both the **Desktop Home Page** and **Mobile Home Page**.
   ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/7c0084ce8d5a071d9c74ad9787d1bc70_wlGZTRsHdx.png)
4. Click **Version Management & Release** and create a version to release it online.

- Click **Create a version**, enter the content required for release, and click **Save**.

  **Note**: Only users within the **Availability status** can open the app.

- Click **Request for release** and the app will go effective immediately.

5. Pull the latest code to local and enter the corresponding directory.

   ```commandline
   git clone https://github.com/larksuite/lark-samples.git
   cd lark-samples/web_app_with_auth_v1/python
   ```

**Note**: The second command line must be used with an unzip tool to unpack the file within the line in order to execute
the third command line.

6. Edit environment variables Edit the app credential data in the `.env` file to real data.

   ```
   APP_ID=cli_9fxxxx00b
   APP_SECRET=EX6xxxxOF
   ```

   The two parameters above can be found in [Developer Console](https://open.larksuite.com/app) > **Credentials & Basic
   Info**.
   
   The redirect URL configuration shall include the `CALLBACK_URL` value defined in the `.env` file. Otherwise, the
   redirection will report an error after login.
   
   ```
   CALLBACK_URL=http://127.0.0.1:3000/callback
   ```

## Running with Docker

Ensure that [Docker](https://www.docker.com) has been installed before running.You can choose to run your code either
with Docker or locally.

**Mac/Linux**

```
exec.sh
```

**Windows**

```
.\exec.ps1
```

After running, directly visit `http://127.0.0.1:3000` and follow the link instructions to scan the code/authorize login.
User information will be visible once the login is successful.

## Running Locally

1. Create and activate a new virtual environment.

   **Mac/Linux**

   ```
   python3 -m venv venv
   . venv/bin/activate
   ```

   **Windows**

   ```
   python3 -m venv venv
   venv\Scripts\activate
   ```

   Once activated, the terminal will display the virtual environment's name.

   ```
   (venv) **** python %
   ```

2. Install dependencies

   ```
   pip install -r requirements.txt
   ```

3. Run

   ```
   python3 server.py
   ```

   After running, directly visit `http://127.0.0.1:3000` and follow the link instructions to scan the code/authorize
   login. User information will be visible once the login is successful.

## Try the web app on Lark

Go to **Lark** > **Workplace** >Search for app name > Open app.

 