# Образ с OpenCode CLI и агентом doc-editor — для OPENCODE_RUNTIME=docker|podman.
# Сборка: npm run opencode:build (или CONTAINER_RUNTIME=podman npm run opencode:build)
FROM node:24-bookworm-slim
RUN npm install -g opencode-ai && useradd -m -s /bin/bash appuser
USER appuser
WORKDIR /home/appuser/work
COPY --chown=appuser:appuser opencode.json ./opencode.json
COPY --chown=appuser:appuser .opencode/ ./.opencode/
CMD ["opencode", "run", "--agent", "doc-editor", "--format", "json"]
