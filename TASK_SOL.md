# Task: Audio Transcription Microservice (Vosk STT)

## Objective
Implement a dedicated audio-processing microservice using **Vosk** (offline Russian STT) that ingests voice/audio files, transcribes speech into text, and feeds it into the existing DocxGen document pipeline identically to a raw text draft.

---

## 1. Technical Requirements & Vosk Mandate
- **Mandatory STT Engine**: Use **Vosk** (`vosk` Node.js bindings or Python/C Vosk sidecar) with a lightweight Russian acoustic model (e.g., `vosk-model-small-ru-0.22`).
- **Audio Preprocessing**: Convert input audio streams (OGG/Opus from VK/MAX, MP3, WAV, M4A) to 16kHz, 16-bit, mono PCM (e.g., via `ffmpeg` / `fluent-ffmpeg` or `wav-decoder`) before passing to Vosk.
- **Port & Entrypoint**: `packages/backend/src/audio-service.js` (port `3005` or `AUDIO_SERVICE_PORT`).

---

## 2. Microservice Architecture & API
- **Endpoint**: `POST /api/audio/transcribe`
  - Accepts `multipart/form-data` with `file` (audio binary).
  - Headers: `X-Owner-Platform`, `X-Owner-Id`, `X-API-Key`.
  - Response: `{ "ok": true, "text": "transcribed Russian text", "duration": 12.4 }`.
- **Pipeline Handoff**:
  - The caller (Bots or Web) uses the returned text to set the draft in Document Service:
    `POST /api/documents` -> `PUT /api/documents/:id/draft` -> `POST /api/documents/:id/process`.

---

## 3. Integration Points
1. **Messenger Bots (`max`, `vk`, `local`)**:
   - Detect voice/audio attachments in inbound events (`voice`, `audio_message`).
   - Download audio buffer, call audio microservice, and transition FSM state to draft collection with the transcribed text.
2. **Web UI (`packages/frontend`)**:
   - Add microphone recording / audio upload control in `DraftEditor.tsx`.
   - Send recorded blob to `/api/audio/transcribe` (or proxied via Vite/Express) and populate the draft editor.

---

## 4. Project Rules & Constraints
- **Grounding**: Never hallucinate requisites or facts missing in the transcription.
- **Error Handling**: Return domain-compliant error responses (`DomainError`, `AUDIO_INVALID`, `STT_FAILED`).
- **Pnpm & Monorepo**: Follow the existing workspace conventions in `packages/backend`.
