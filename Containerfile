FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    xz-utils \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Install typst binary
ARG TYPST_VERSION=0.12.0
RUN curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
    | tar -xJ --strip-components=1 -C /usr/local/bin

# Install opencode via official installer, then copy to /usr/local/bin
RUN curl -fsSL https://opencode.ai/install | bash && \
    cp /root/.opencode/bin/opencode /usr/local/bin/opencode && \
    chmod +x /usr/local/bin/opencode

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Copy project-local config and skills
COPY --chown=appuser:appuser .opencode/ /home/appuser/.opencode/
COPY --chown=appuser:appuser opencode.json /home/appuser/opencode.json

USER appuser
WORKDIR /app

# Default command
CMD ["opencode", "run", "--agent", "typst-generator", "--format", "json"]
