#!/bin/bash
# build.sh — Build the opencode container image

set -e

IMAGE_NAME="docxgen-opencode"
RUNTIME="${CONTAINER_RUNTIME:-podman}"

if ! command -v "$RUNTIME" >/dev/null 2>&1; then
  echo "Container runtime '$RUNTIME' not found. Set CONTAINER_RUNTIME=docker or install Podman."
  exit 1
fi

echo "🔨 Building $IMAGE_NAME..."
"$RUNTIME" build -t "$IMAGE_NAME" -f Containerfile .

echo "✅ Built $IMAGE_NAME"
echo ""
echo "Usage:"
echo "  $RUNTIME run --rm -v ./data:/app/data $IMAGE_NAME opencode run 'your prompt here'"
