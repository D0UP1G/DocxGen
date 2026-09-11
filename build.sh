#!/bin/bash
# build.sh — Build the opencode container image

set -e

IMAGE_NAME="docxgen-opencode"

echo "🔨 Building $IMAGE_NAME..."
podman build -t "$IMAGE_NAME" -f Containerfile .

echo "✅ Built $IMAGE_NAME"
echo ""
echo "Usage:"
echo "  podman run --rm -v ./data:/app/data $IMAGE_NAME opencode run 'your prompt here'"
