docker build -t web-app-with-jssdk-python .
docker run --env-file .env -p 3000:3000 -it web-app-with-jssdk-python
