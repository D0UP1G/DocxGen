#!/usr/bin/env bash
set -e
pkill -f 'concurrently.*docxgen' 2>/dev/null || true
pkill -f 'audio-service.js' 2>/dev/null || true
pkill -f 'document-service.js' 2>/dev/null || true
pkill -f 'vite/bin/vite.js' 2>/dev/null || true
echo 'Старые DocxGen-процессы остановлены.'
