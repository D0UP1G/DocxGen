#!/usr/bin/env python3
"""Small Vosk sidecar used when the Node ffi binding cannot compile."""
import json
import os
import sys

try:
    from vosk import Model, KaldiRecognizer
except Exception as exc:
    print(json.dumps({"error": f"Vosk не установлен: {exc}"}, ensure_ascii=False), flush=True)
    sys.exit(1)

model = Model(os.environ["VOSK_MODEL_PATH"])
for line in sys.stdin:
    try:
        request = json.loads(line)
        recognizer = KaldiRecognizer(model, 16000)
        recognizer.AcceptWaveform(bytes.fromhex(request["pcm"]))
        result = json.loads(recognizer.FinalResult())
        print(json.dumps({"text": result.get("text", "")}, ensure_ascii=False), flush=True)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), flush=True)
