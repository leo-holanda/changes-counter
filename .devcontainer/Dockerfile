# To build an image, navigate to the repository root and run: docker build -t changes-counter -f .devcontainer/Dockerfile .
# To create a container, run: docker run -it --rm changes-counter
# Then, follow the VS Code CLI instructions on how to connect to the remote enviroment

FROM ubuntu:latest
WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/* \
    && npm i

# Install VS Code CLI so it's possible to create a tunnel
RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz \
    && tar -xzf vscode_cli.tar.gz \
    && rm vscode_cli.tar.gz \
    && apt purge --auto-remove -y curl

ENTRYPOINT ./code tunnel