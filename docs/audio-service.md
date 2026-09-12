# Audio service

The web app sends audio to `http://127.0.0.1:3005` through the Vite proxy.
The frontend must be started with its working directory set to
`packages/frontend`; otherwise Vite may not load `packages/frontend/vite.config.ts`
and `/api/audio` becomes a local Vite 404.
Run the whole development stack from the repository root:

```bash
pnpm install
pnpm dev
```

The `dev` script starts the backend (`PORT`, default `3000`) with in-process
bot adapters, the audio service (`3005`), and the frontend. If the browser was already open while changing this script,
stop the old processes and start `pnpm dev` again; Vite cannot start a service
that was not part of an earlier process.

The STT service additionally requires:

- `ffmpeg` in `PATH`;
- Python 3 with the `vosk` package (`python3 -m pip install vosk`);
- the Russian model at `VOSK_MODEL_PATH` (default
  `./models/vosk-model-small-ru-0.22`, relative to `packages/backend`).

Check the service before using the microphone:

```bash
curl http://127.0.0.1:3005/health
```

It must return `{"ok":true}`. A browser-side HTTP 502 means that nothing is
listening on port 3005 (usually an old `pnpm dev` process); restart the stack.

The service uses a Python Vosk sidecar because the Node `vosk` package depends
on `ffi-napi`, which does not build with Node 24. Install the runtime and model
before starting it:

The repository includes a setup script that creates an isolated Python
environment, installs Vosk, and downloads the model:

```bash
cd packages/backend
npm run setup:audio
```

Then restart `npm run dev` from the repository root. The model path is resolved
relative to `packages/backend`, so starting the command from another directory
does not silently point Vosk at the wrong location.

If port 5173 was already occupied by an older Vite process, its old proxy
configuration remains active. Stop it with `bash scripts/stop-dev.sh`, then run
`npm run dev` again.
