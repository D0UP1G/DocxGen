# DocxGen — Генератор деловых документов

> AI-powered pipeline: вводите текст → получаете .docx по ГОСТ Р 6.30-2003

---

## 🎯 Что это

Сервис для автоматической генерации служебных документов на русском языке. Пользователь вводит «сырой» текст, AI исправляет ошибки, форматирует по ГОСТ, и на выходе получается готовый .docx файл.

**Поддерживаемые типы документов:**
- Служебная записка
- Докладная записка
- Информационная справка
- Письмо

**Два шаблона:**
- **Официальный** — строго по ГОСТ Р 6.30-2003 (Times New Roman 14pt, поля 3cm/1.5cm)
- **Стандартный** — упрощённый стиль для внутренних документов (Libertinus Serif 12pt)

---

## 🏗 Архитектура

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│   Podman     │
│  React+Vite  │    │   Express    │    │  opencode    │
│  :5173       │    │   :3001      │    │  (AI model)  │
└─────────────┘    └──────────────┘    └──────────────┘
                         │
                         ▼
                   ┌──────────────┐
                   │   Pipeline   │
                   │  Typst→PDF   │
                   │  Pandoc→DOCX │
                   └──────────────┘
```

**Поток данных:**
1. Пользователь вводит текст + выбирает тип + шаблон
2. Backend отправляет текст в Podman контейнер (opencode CLI)
3. AI возвращает JSON: `{ correctedText, requisites, documentType }`
4. Backend применяет шаблон (Typst) → компилирует в PDF
5. Pandoc конвертирует PDF → .docx
6. Файл возвращается пользователю через SSE

---

## 📁 Структура проекта

```
DocxGen/
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── index.ts                    # Express сервер (порт 3001)
│   │       ├── document-types.ts           # Типы документов, интерфейс Requisites
│   │       ├── prompts/
│   │       │   ├── document-prompts.ts     # SSOT для AI промптов
│   │       │   └── examples/               # Few-shot примеры для AI
│   │       ├── routes/
│   │       │   └── document.ts             # POST /api/generate (SSE)
│   │       ├── services/
│   │       │   ├── ai.service.ts           # Запуск opencode в Podman
│   │       │   ├── validation.service.ts   # Валидация реквизитов
│   │       │   ├── typst.service.ts        # Компиляция Typst
│   │       │   └── pandoc.service.ts       # Конвертация в DOCX
│   │       └── templates/
│   │           ├── index.ts                # Интерфейс + реестр шаблонов
│   │           ├── official.ts             # ГОСТ шаблон
│   │           └── standard.ts             # Стандартный шаблон
│   └── frontend/
│       └── src/
│           └── components/
│               └── DocumentGenerator.tsx    # Основной UI компонент
├── Containerfile                           # Определение контейнера
├── opencode.json                           # Конфигурация opencode
├── .opencode/
│   └── agents/
│       └── typst-generator.md              # Определение AI агента
├── spec/                                   # Примеры документов
│   ├── Примеры/                            # Текстовые примеры
│   └── Папка/                              # .docx примеры (эталон)
├── test_inputs/                            # Тестовые входные данные
└── PLAN.md                                 # План реализации
```

---

## 🚀 Запуск

### Предварительные требования

- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Podman** (или Docker)
- **Typst** (`cargo install typst-cli`)
- **Pandoc** (`apt install pandoc` или `brew install pandoc`)

### 1. Сборка контейнера

```bash
podman build -t localhost/docxgen-opencode:latest .
```

### 2. Установка зависимостей

```bash
pnpm install
```

### 3. Запуск

```bash
pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

### 4. Тестирование

Используйте входные данные из `test_inputs/`:

```bash
# Пример входных данных
cat test_inputs/input1_official_letter.txt
```

Откройте http://localhost:5173, вставьте текст, выберите тип и шаблон.

---

## 🔧 Ключевые компоненты

### AI Сервис (`ai.service.ts`)

Запускает `opencode` CLI внутри Podman контейнера:

```typescript
const proc = spawn('podman', [
  'run', '--rm', '-i',
  '--network=host',
  'localhost/docxgen-opencode:latest',
  'opencode', '--model', 'opencode/big-pickle', '--agent', 'typst-generator'
]);
```

Промпт передаётся через stdin. AI возвращает JSON с исправленным текстом и реквизитами.

### Шаблоны (`templates/`)

Каждый шаблон — объект с методом `generate(data)`:

```typescript
interface TypstTemplate {
  id: string;
  name: string;
  description: string;
  generate: (data: DocumentData) => string;
}
```

Шаблон генерирует Typst исходный код, который компилируется в PDF.

### Валидация (`validation.service.ts`)

Проверяет обязательные поля для каждого типа документа:

```typescript
const requiredFields: Record<string, (keyof Requisites)[]> = {
  sluzhebnaya: ['to', 'from', 'date', 'subject'],
  dokladnaya: ['to', 'from', 'date', 'subject'],
  informatssionnaya: ['to', 'from', 'date', 'subject'],
  pisimo: ['to', 'from', 'date', 'subject'],
};
```

Отсутствующие поля помечаются `[Заполнить]` в Typst и показываются жёлтым в UI.

---

## 📝 Промпты (SSOT)

Все промпты для AI живут в `packages/backend/src/prompts/document-prompts.ts`:

- `getMainPrompt()` — основной промпт для анализа текста
- `getFixPrompt()` — промпт для исправления ошибок Typst

**Важно:** `correctedText` должен быть ЧИСТЫМ текстом (plain text), не Typst разметкой.

---

## 🐛 Известные проблемы

1. **AI генерирует Typst разметку** — исправлено добавлением few-shot примеров
2. **Скобки `[` `]` в выводе** — исправлено удалением `escapeTypst`
3. **Пустой correctedText** — иногда AI возвращает пустой текст, cần retry

---

## 🧪 Тестирование

### Тестовые входные данные

| Файл | Тип | Описание |
|------|-----|----------|
| `input1_official_letter.txt` | Письмо | Все поля заполнены |
| `input2_sluzhebnaya.txt` | Служебная записка | Часть полей отсутствует |
| `input3_dokladnaya.txt` | Докладная записка | Все поля заполнены |
| `input4_informatsionnaya.txt` | Информационная справка | Все поля заполнены |
| `input5_dirty_draft.txt` | Любой | «Грязный» черновик с ошибками |

### Проверка pipeline

```bash
# 1. Запустите сервер
pnpm dev

# 2. Откройте http://localhost:5173

# 3. Вставьте текст из test_inputs/

# 4. Выберите тип и шаблон

# 5. Нажмите «Сгенерировать»

# 6. Проверьте .docx файл
```

---

## 📦 Деплой

### Контейнер

```bash
# Сборка
podman build -t localhost/docxgen-opencode:latest .

# Проверка
podman run --rm localhost/docxgen-opencode:latest opencode --help
```

### Backend

```bash
pnpm build
node packages/backend/dist/index.js
```

### Frontend

```bash
cd packages/frontend
pnpm build
# Статические файлы в dist/
```

---

## 🔗 Ссылки

- **GitHub:** https://github.com/SomeSuperCoder/DocxGen
- **Hackathon:** Первенство России 2026 — Продуктовое программирование
- **Задача:** «Документ за 3 шага»

---

## 📄 Лицензия

MIT
