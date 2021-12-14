# Quickly develop a web app

If you need to develop a web app that obtains the information of logged-in users from the Feishu, you can refer to this
article as an example. This example uses the Feishu client jssdk. The login status of the client-side is used to carry out
the logged-in user information query feature.

## Runtime environment

- [Python 3](https://www.python.org/)

## Prep work

1. In [Developer Console](https://open.larksuite.com/app), click **Create custom app**. Once successfully created, click
   the app to open it, and click **Credentials & Basic Info**, where you can obtain the App ID and App Secret.
   ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/2176e0e2eb1cec4ec34c31e4e139a783_6SXGgsDy4q.png)
2. Click **Web App** switch page and turn on the **Use Web Page** option. Modify the **Web Page Setting** and
   enter `http://127.0.0.1:3000` as both the **Desktop Home Page** and **Mobile Home Page**.
   ![image.png](https://sf3-cn.feishucdn.com/obj/open-platform-opendoc/7c0084ce8d5a071d9c74ad9787d1bc70_wlGZTRsHdx.png)
3. Click **Security Settings** and configure the **h5 trusted domain** as `http://127.0.0.1:3000`
4. Click **Version Management & Release** and create a version to release it online.

- Click **Create a version**, enter the content required for release, and click **Save** to create a version.

  **Note**: Only users within the **Availability status** can open the app.

- Click **Request for release** and the app will go effective immediately.

5. Pull the latest code to local and enter the corresponding directory.

    ```
    git clone https://github.com/larksuite/lark-samples.git
    cd lark-samples/web_app_with_jssdk/python
    ```


6. Edit environment variables Edit the application credential data in the `.env` file to real data.

    ```
    APP_ID=cli_9fxxxx00b
    APP_SECRET=EX6xxxxOF
    ```

   The two parameters above can be found in [Developer Console](https://open.larksuite.com/app) > **Credentials & Basic
   Info**.

## Running with Docker

Ensure that [Docker](https://www.docker.com/) has been installed before running.You can choose to run your code either
with Docker or locally.

**Mac/Linux**

```
sh exec.sh
```

**Windows**

```
.\exec.ps1
```

Once it's running, you can only try it in Feishu. Go to **Feishu** > **Workplace** > Search for app name > Open app.

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

Once it's running, you can only try it in Feishu. Go to **Feishu** > **Workplace** > Search for app name > Open app.
 
 
