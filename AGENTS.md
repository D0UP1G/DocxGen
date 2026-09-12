# Руководство по архитектуре и разработке проекта DocxGen

> Этот документ содержит исчерпывающее описание архитектуры, сценариев работы, потоков данных, ключевых соглашений, применённых и рекомендуемых исправлений проекта **DocxGen** для ИИ-агентов (в т.ч. GPT Sol) и разработчиков.

---

## 1. Обзор проекта

**DocxGen** — сервис генерации официально-деловых документов в формате DOCX по ГОСТ Р 7.0.97-2016 на основе неструктурированного текста пользователя.

- **Поддерживаемые типы документов**:
  1. `memo` — Служебная записка (внутренняя переписка между подразделениями).
  2. `report` — Докладная записка (обращение к вышестоящему руководству с выводами/предложениями).
  3. `reference` — Информационная справка (описание фактов, состояния дел, параметров).
  4. `letter` — Деловое/официальное письмо (внешняя переписка с адресатом).
- **Шаблоны оформления DOCX**:
  - `classic` — Классический (Times New Roman 14pt / 12pt, одинарный / 1.15 интервал, строгие границы, книжная ориентация).
  - `modern` — Современный (Aptos / Arial, акцентная полоса, компактная шапка).
- **Интерфейсы взаимодействия**:
  - Web UI (React + Redux Toolkit + Tailwind CSS + Vite).
  - MAX Bot (платформа корпоративного мессенджера MAX: вебхуки или polling).
  - VK Bot (сообщество ВКонтакте: Callback API или Bots LongPoll).
  - Local Chat (`/dev/chat` — локальный HTTP-эмулятор мессенджера без сторонних токенов).

---

## 2. Структура монорепозитория

Проект организован как **pnpm workspace**:

```
DocxGen/
├── .env / .env.example          # Конфигурация окружения всего проекта
├── package.json                 # Корневые workspace-скрипты
├── pnpm-workspace.yaml          # Определение пакетов (packages/*)
├── AGENTS.md                    # Этот документ (руководство агента)
├── docs/                        # Документация (api.md, microservices.md, etc.)
├── data/                        # Каталог БД SQLite (app.sqlite) и файлов DOCX
└── packages/
    ├── backend/                 # Node.js сервис (Express + better-sqlite3 + docx + pino)
    │   ├── package.json
    │   ├── opencode/            # Конфигурация doc-editor агента OpenCode CLI
    │   ├── config/              # Описания типов документов и шаблонов (JSON)
    │   ├── scripts/             # CLI-скрипты (eval, check, poll, subscribe)
    │   ├── tests/               # Тесты Vitest (unit, integration, e2e)
    │   └── src/
    │       ├── app.js           # Express app (маршрутизация, middleware, cookie/auth)
    │       ├── runtime.js       # Composition root (монолитный запуск)
    │       ├── document-service.js # Микросервис документов (:3001)
    │       ├── max-bot-service.js  # Микросервис бота MAX (:3002)
    │       ├── vk-bot-service.js   # Микросервис бота VK (:3003)
    │       ├── local-bot-service.js# Микросервис стенда /dev/chat (:3004)
    │       ├── core/            # Доменная модель документов (documentService.js, errors.js, events.js)
    │       ├── db/              # Инициализация и миграции better-sqlite3
    │       ├── client/          # REST-клиент и прямой in-process клиент документов
    │       ├── ai/              # Провайдеры ИИ (opencode, openai-compat, mock), fault injection, grounding
    │       ├── bot/             # Стейт-машина диалога (flow.js), диспетчер (dispatcher.js), нотификатор (notifier.js)
    │       ├── docx/            # Генерация docx (render.js, blocks.js, styles.js, validator.js)
    │       ├── jobs/            # Очередь на SQLite (queue.js, worker.js) и обработчики (processDocument, cleanup)
    │       └── adapters/        # Адаптеры мессенджеров (max, vk, local)
    └── frontend/                # React SPA (Vite + TS + Tailwind + Redux Toolkit)
        ├── package.json
        ├── vite.config.ts       # Проксирует /api и /health на http://localhost:3001
        └── src/
            ├── components/      # UI-компоненты (DraftEditor, DocumentPreview, Wizard, etc.)
            ├── store/           # Redux-хранилище (documentSlice, steps)
            └── types/           # TypeScript-типы (document.ts, etc.)
```

---

## 3. Архитектура и режимы запуска

Сервис спроектирован с возможностью работы в двух режимах:

### А. Монолитный режим (`runtime.js`)
Единый процесс, где все компоненты (документ-сервис, воркер очереди, ИИ, диспетчер ботов и роуты локального чата / API) работают в одном процессе Node.js:
- Используется в интеграционных тестах (`tests/integration/bots.test.js` через `createRuntime`).
- Использует **`createDirectDocuments(documentService)`** из `src/client/directClient.js` — прямой in-process адаптер с интерфейсом `.withOwner(owner)` без лишних HTTP-запросов и без необходимости слушать порт 3001.

### Б. Микросервисный режим (Split Mode)
- **Document Service** (`src/document-service.js`, порт `3001` / `DOCUMENT_SERVICE_PORT`):
  - Хранение черновиков, версий, реквизитов в SQLite.
  - Фоновый воркер обработки очереди задач (`jobs/worker.js`).
  - Вызов провайдера ИИ (`ai/processDraft.js`).
  - Рендеринг `.docx` файлов (`docx/render.js`).
  - REST API с аутентификацией: Session Cookie для Web, либо `X-API-Key` + `X-Owner-Platform` / `X-Owner-Id` для ботов.
- **Bot Services** (`max-bot-service.js`, `vk-bot-service.js`, `local-bot-service.js`):
  - Принимают события от платформ / локального чата.
  - Ведут состояние диалога (FSM в памяти + SQLite).
  - Взаимодействуют с Document Service по REST через `createDocumentServiceClient({ baseUrl, apiKey })`.
  - Отслеживают статус генерации через опрос `createNotifier({ docServiceClient })`.
- **Frontend** (`packages/frontend`):
  - Vite dev-сервер (порт `3000` / `5173`) проксирует `/api` и `/health` на Document Service `http://localhost:3001`.

---

## 4. Пайплайн обработки документов и ИИ

```
[Пользователь / Черновик]
          │
          ▼
   [documentService.setDraft]  ─── Запись в SQLite, статус = 'draft'
          │
          ▼
 [documentService.startProcessing] ── Enqueue job 'process_document'
          │
          ▼
   [jobs/worker.js] (poll 500ms, atomic claim UPDATE job_queue)
          │
          ▼
[handlers/processDocument.js]
          │
          ├── 1. Загрузка черновика и описания типа документа (docTypes)
          ├── 2. ai/processDraft.js:
          │      ├── Проверка длины черновика (лимиты min/max)
          │      ├── Вызов AI Provider (opencode / openai-compat / mock)
          │      ├── Парсинг JSON-ответа (title, body, requisites, missing_requisites)
          │      ├── Валидация по Zod-схеме (aiResponseSchema)
          │      ├── Grounding check: проверка галлюцинаций (проверка фактов против исходника)
          │      └── Валидация реквизитов (проверка наличия обязательных полей ГОСТ)
          ├── 3. Сохранение версии в `versions` и полей в `fields`
          └── 4. doc.status = 'processed' (или 'ai_failed' при ошибке/сбое)
          │
          ▼
 [bot/notifier.js] (poll 5s как owner документа) ───► [bot/flow.js] (state -> 'ready' / 'asking_field')
          │
          ▼
[documentService.render] (docx/render.js) ───► Генерация .docx в data/storage/
```

### Провайдеры ИИ (`AI_PROVIDER` в `.env`):
1. **`opencode`** (по умолчанию для прод-режима):
   - Запуск локального OpenCode CLI (`opencode run --format json --agent doc-editor`).
   - Использует бесплатные модели OpenCode Zen (ключ не требуется).
   - Ограничение параллелизма: `OPENCODE_MAX_PARALLEL=1` (бесплатные модели не держат конкурентные запросы с одного IP).
2. **`openai-compat`**:
   - Работает с любым OpenAI-совместимым сервером (Ollama, vLLM, DeepSeek, LocalAI, облачные API) через `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`.
3. **`mock`**:
   - Тестовая заглушка без обращения к сети. Разбивает черновик на абзацы и возвращает типовой ответ.

---

## 5. Модель данных (SQLite, `data/app.sqlite`)

Основные таблицы:
- `documents`: `id`, `owner_platform`, `owner_id`, `status` (`draft`, `processing`, `processed`, `ai_failed`), `doc_type`, `template_id`, `source_text`, `created_at`, `updated_at`.
- `versions`: `id`, `document_id`, `version_number`, `title`, `body` (JSON array of strings), `stale` (boolean).
- `fields`: `document_id`, `key`, `value` — значения реквизитов (адресат, автор, дата, номер и т.д.).
- `files`: `id`, `document_id`, `filename`, `path`, `mime_type`, `size`, `created_at`.
- `job_queue`: `id`, `type`, `payload`, `status` (`pending`, `running`, `completed`, `failed`), `attempts`, `max_attempts`, `scheduled_at`.
- `conversations`: состояние FSM ботов (`state`, `state_version`, `document_id`, `context`).
- `inbound_events`: дедупликация входящих событий от платформ (`event_id`, `status`).
- `processing_log`: журнал шагов ИИ для отладки (`stage`, `data`, `created_at`).

---

## 6. Состояния стейт-машины ботов (`bot/flow.js`)

- `idle` — ожидание первого сообщения (команда `/start`, `/help` или отправка текста).
- `collecting` — сбор текста черновика (можно дописывать сообщениями).
- `choose_type` — выбор типа документа (кнопки: Служебная записка, Докладная записка, Справка, Письмо).
- `choose_template` — выбор шаблона (Классический / Современный).
- `processing` — документ отправлен в очередь на обработку ИИ (нотификатор отслеживает смену статуса).
- `asking_field` — запрос недостающего обязательного реквизита у пользователя.
- `ready` — документ готов; отправка сформированного `.docx` файла и кнопок действий («Изменить реквизиты», «Сменить шаблон», «Новый документ»).
- `ai_failed` — сбой ИИ (предлагает «Повторить» или скорректировать черновик).

---

## 7. Применённые исправления (Applied Fixes)

В ходе аудита кодовой базы были обнаружены и устранены следующие дефекты:

1. **In-process клиент для монолита (`packages/backend/src/client/directClient.js`)**:
   - *Проблема*: `runtime.js` использовал `createDocumentServiceClient` (REST-клиент на `localhost:3001`). В монолитном режиме и тестах порт 3001 не открывался, что приводило к ошибке `ECONNREFUSED 127.0.0.1:3001` и падению тестов бота.
   - *Решение*: Создан `createDirectDocuments(documentService)` с идентичным интерфейсом `.withOwner(owner)`. `runtime.js` переведён на прямой вызов in-process сервиса.

2. **Аутентификация владельца в нотификаторе (`packages/backend/src/bot/notifier.js`)**:
   - *Проблема*: `pollTrackedDocuments` опрашивал Document Service без заголовков владельца (`X-Owner-*`), из-за чего сервис возвращал `NOT_FOUND` (чужой документ), и боты навсегда зависали в состоянии `processing`.
   - *Решение*: В нотификатор добавлен поиск диалога `dispatcher.findByDocumentId(documentId)` и вызов `docServiceClient.withOwner({ platform, id })`.

3. **Защита от Unhandled Promise Rejection во Flow (`packages/backend/src/bot/flow.js`)**:
   - *Проблема*: Вызовы `processDocument` и `retryProcessing` выполнялись асинхронно ("fire-and-forget") без `.catch()`. При мгновенном сбое задачи промис отклонялся без обработчика.
   - *Решение*: Вызовы обёрнуты в `Promise.resolve(...).catch(err => log.error(...))`.

4. **Предотвращение дублирования буквы «О » в заголовке DOCX (`packages/backend/src/docx/blocks.js`)**:
   - *Проблема*: При возврате заголовка вроде `"О согласовании отпуска"` функция формирования блока добавляла префикс повторно, получая `"О О согласовании отпуска"`.
   - *Решение*: Добавлен guard `title.trim().startsWith('О ') ? title.trim() : ...`.

5. **Сохранение сгенерированного ИИ заголовка во фронтенде (`packages/frontend/src/store/documentSlice.ts`)**:
   - *Проблема*: `generateDocument` в `documentSlice.ts` жестко перезаписывал заголовок значением `'Документ'`, стирая результат работы ИИ.
   - *Решение*: Перед сохранением текста делается GET документа и используется `current.version?.title || 'Документ'`.

6. **Кроссплатформенность путей Windows в OpenCode CLI (`packages/backend/src/ai/providers/opencodeCli.js`)**:
   - *Проблема*: `resolveOpencodeBin` использовал host-зависимый `path.join`, из-за чего на Linux-хостах падало тестирование эмуляции Windows.
   - *Решение*: Использован `path.win32.join` и `path.win32.delimiter` для явного win32-резолвинга.

7. **Исправление типов и тестов фронтенда (`packages/frontend/src/store/__tests__/documentSlice.test.ts`)**:
   - *Проблема*: Тест передавал невалидные литералы типов (`'dokladnaya'` вместо `'report'`, `'standard'` вместо `'classic'`), вызывая ошибку компиляции `tsc -b`.
   - *Решение*: Значения приведены в соответствие с `DocumentTypeId` и `TemplateId`.

---

## 8. Команды для сборки, тестирования и запуска

> **Примечание по pnpm**: Если глобальный `pnpm` отсутствует на машине, используйте локальный бинарник `/tmp/opencode/pnpm-bin/node_modules/.bin/pnpm` или установите через `npm i -g pnpm`.

### Тестирование и проверка качества:
```bash
# Все юнит- и интеграционные тесты бэкенда (21 файл, 264 теста)
pnpm --filter @docxgen/backend test

# Запуск тестов Vitest напрямую
pnpm --filter @docxgen/backend exec vitest run

# Проверка типов фронтенда (TypeScript tsc -b)
pnpm --filter @docxgen/frontend typecheck

# Тесты фронтенда (34 теста)
pnpm --filter @docxgen/frontend exec vitest run

# Линтер фронтенда (oxlint)
pnpm --filter @docxgen/frontend lint
```

### Запуск сервисов:
```bash
# Запуск монолита (Document service + Local chat + Web API)
pnpm --filter @docxgen/backend start

# Запуск полного стека разработки (Doc Service + 3 бота + Frontend Vite)
pnpm dev

# Сборка всех пакетов
pnpm build
```

---

## 9. Памятка для ИИ-агента (GPT Sol Rules of Engagement)

1. **Принцип неизменности фактов (Grounding)**: ИИ не имеет права додумывать фактические данные, даты, ФИО или числовые показатели, отсутствующие в исходном черновике пользователя. Если реквизит отсутствует — запрашивать через `missing_requisites` или подставлять маркер `[Реквизит]` с желтым фоном.
2. **Форматирование DOCX**: Оформление документа выполняется строго кодом шаблонизатора (`docx/render.js`, `docx/blocks.js`), а не разметкой в тексте ответа модели.
3. **Ошибки и статусы**: Любые доменные исключения должны быть экземплярами `DomainError` (с кодами `FORBIDDEN`, `NOT_FOUND`, `BUSY`, `DRAFT_EMPTY` и соответствующими HTTP-статусами). Инфраструктурные сбои ИИ — `AiUnavailableError` (статус 503).
4. **Конфиденциальность и безопасность**: Все операции с базой данных должны быть параметризованы (better-sqlite3 prepared statements). Запрещено логировать секретные токены (`MAX_TOKEN`, `VK_TOKEN`, `AI_API_KEY`).
