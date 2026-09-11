# DocxGen — Generador de Documentos con IA

Prototipo MVP que demuestra el uso de IA + Typst + Pandoc para generar documentos `.docx` a partir de texto libre.

## Arquitectura

```
┌─────────────────────────────────────┐
│         React + Shadcn UI           │
│  Textarea → "Generar" → Download    │
└──────────────┬──────────────────────┘
               │ POST /api/generate
               ▼
┌─────────────────────────────────────┐
│          Express Backend            │
│  /api/generate                      │
│    ├── AIService → OpenCode API     │
│    ├── TypstService → typst compile │
│    ├── PandocService → pandoc       │
│    └── Serve .docx for download     │
└─────────────────────────────────────┘
```

## Pipeline de Generación

1. Usuario ingresa texto en el frontend
2. Frontend envía `POST /api/generate { text: "..." }`
3. Backend llama a la API de OpenCode AI (modelo `big-pickle`)
4. IA genera markup Typst válido
5. Typst compila `.typ` → `.pdf`
6. Pandoc convierte `.typ` → `.docx`
7. Backend sirve el `.docx` para descarga
8. Frontend descarga automáticamente el archivo

## Requisitos

- Node.js >= 22
- pnpm >= 10
- `typst` instalado vía sistema (`dnf install typst` o similar)
- `pandoc` instalado vía sistema (`dnf install pandoc` o similar)

## Instalación

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd DocxGen
pnpm install
```

## Desarrollo

```bash
# Terminal 1 — Backend (puerto 3001)
pnpm dev:backend

# Terminal 2 — Frontend (puerto 5173)
pnpm dev:frontend

# O ambos en paralelo
pnpm dev
```

## Uso

1. Abre `http://localhost:5173` en tu navegador
2. Escribe o pega texto en el textarea
3. Haz clic en "Generar y Descargar .docx"
4. El archivo se descargará automáticamente

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| UI | Shadcn UI (Button, Textarea, Card) |
| Backend | Express + TypeScript |
| IA | OpenCode API (`big-pickle` model) |
| Maquetación | Typst (compilación a PDF) |
| Conversión | Pandoc (Typst → DOCX) |

## API

### `POST /api/generate`

**Request:**
```json
{
  "text": "Tu contenido aquí..."
}
```

**Response:** Archivo `.docx` como attachment

**Error:**
```json
{
  "error": "Descripción del error"
}
```

### `GET /health`

```json
{
  "status": "ok",
  "timestamp": "2026-09-11T..."
}
```

## Licencia

MIT
