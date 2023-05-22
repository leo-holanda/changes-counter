# To build an image, navigate to the repository root and run: docker build -t changes-counter -f .devcontainer/Dockerfile .
# To create a container, run: docker run -it --rm changes-counter
# To start the VS Code Server and create a tunnel, run in the container shell: ./code tunnel
# Then, follow the VS Code CLI instructions on how to connect to the remote enviroment

FROM alpine:latest
WORKDIR /changes-counter
COPY . .

RUN apk add git
RUN apk add nodejs npm
RUN npm i

# Install VS Code CLI so it's possible to create a tunnel
RUN apk add curl
RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz
RUN tar -xzf vscode_cli.tar.gz