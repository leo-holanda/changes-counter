FROM alpine:latest
WORKDIR /root/changes-counter
COPY . .

RUN apk add git
RUN apk add nodejs npm
RUN npm i

# Install Code CLI so it's possible to create a tunnel
RUN apk add curl
RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz
RUN tar -xzf vscode_cli.tar.gz