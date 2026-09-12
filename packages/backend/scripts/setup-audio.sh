#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${VOSK_PYTHON:-python3}"
VENV="$ROOT/.venv-audio"
MODEL_DIR="$ROOT/models/vosk-model-small-ru-0.22"
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip"

command -v "$PYTHON" >/dev/null || { echo "Не найден Python: $PYTHON" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "Не найден ffmpeg. Установите ffmpeg и повторите." >&2; exit 1; }
"$PYTHON" -m venv "$VENV" 2>/dev/null || {
  echo "Не удалось создать venv. Установите пакет python3-venv и повторите." >&2
  exit 1
}
"$VENV/bin/python" -m pip install --upgrade pip vosk

if [[ ! -f "$MODEL_DIR/am/final.mdl" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fL --retry 3 "$MODEL_URL" -o "$tmp/model.zip"
  unzip -q "$tmp/model.zip" -d "$ROOT/models"
fi

echo "Audio STT готов. Запуск из корня проекта: npm run dev"
