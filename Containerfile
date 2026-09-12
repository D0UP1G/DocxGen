FROM node:22-slim

# Install the small set of tools needed by the optional AI worker.
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install opencode via official installer, then copy to /usr/local/bin
RUN curl -fsSL https://opencode.ai/install | bash && \
    cp /root/.opencode/bin/opencode /usr/local/bin/opencode && \
    chmod +x /usr/local/bin/opencode

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Copy project-local config and skills
COPY --chown=appuser:appuser container/.opencode/ /home/appuser/.opencode/
COPY --chown=appuser:appuser container/opencode.json /home/appuser/opencode.json

USER appuser
WORKDIR /app

# Default command
CMD ["opencode", "run", "--agent", "document-analyst", "--format", "json"]
