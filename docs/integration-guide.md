# Integration Guide

This guide shows how to use the DocxGen API to generate DOCX documents programmatically. It's for web developers, bot developers, and anyone building integrations.

## Prerequisites

- DocxGen server running (local or deployed)
- HTTP client (curl, fetch, axios, etc.)

## Authentication

Cookie-based. The server creates a `sid` cookie on first request (httpOnly, sameSite lax, 1 year). All document operations are scoped to this cookie — different cookies = different owners.

**No login required.** The cookie IS the identity.

## Quick Start: Generate a Document in 5 Steps

### Step 1: Create a Document

Create a new document with your draft text.

**curl:**
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "sourceText": "Служебная записка\nКому: Иванову И.И.\nОт: Петров П.П.\nДата: 12.09.2026\n\nО выполнении плана\n\nНастоящим сообщаю о выполнении плана на 120%.",
    "docType": "memo",
    "templateId": "classic"
  }'
```

**JavaScript (fetch):**
```javascript
const response = await fetch('http://localhost:3000/api/documents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important: sends cookies
  body: JSON.stringify({
    sourceText: 'Служебная записка\nКому: Иванову И.И.\nОт: Петров П.П.\nДата: 12.09.2026\n\nО выполнении плана\n\nНастоящим сообщаю о выполнении плана на 120%.',
    docType: 'memo',
    templateId: 'classic'
  })
});
const doc = await response.json();
console.log('Document ID:', doc.id);
```

**Python (requests):**
```python
import requests

response = requests.post('http://localhost:3000/api/documents', json={
    'sourceText': 'Служебная записка\nКому: Иванову И.И.\nОт: Петров П.П.\nДата: 12.09.2026\n\nО выполнении плана\n\nНастоящим сообщаю о выполнении плана на 120%.',
    'docType': 'memo',
    'templateId': 'classic'
})
doc = response.json()
print(f"Document ID: {doc['id']}")
```

### Step 2: Start AI Processing

Start AI processing. This returns immediately (async).

**curl:**
```bash
curl -X POST http://localhost:3000/api/documents/{id}/process
```

**JavaScript:**
```javascript
const processResponse = await fetch(`http://localhost:3000/api/documents/${doc.id}/process`, {
  method: 'POST',
  credentials: 'include'
});
const job = await processResponse.json();
console.log('Job started:', job.jobId);
```

**Python:**
```python
process_response = requests.post(f'http://localhost:3000/api/documents/{doc["id"]}/process')
job = process_response.json()
print(f"Job started: {job['jobId']}")
```

### Step 3: Poll for Completion

The `/process` endpoint returns immediately. Poll the document status until processing completes.

**curl:**
```bash
# Poll until status is 'processed' or 'ai_failed'
while true; do
  STATUS=$(curl -s http://localhost:3000/api/documents/{id} | jq -r '.status')
  if [ "$STATUS" = "processed" ] || [ "$STATUS" = "ai_failed" ]; then
    break
  fi
  sleep 2
done
```

**JavaScript:**
```javascript
async function waitForProcessing(docId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`http://localhost:3000/api/documents/${docId}`, {
      credentials: 'include'
    });
    const doc = await response.json();
    
    if (doc.status === 'processed') return doc;
    if (doc.status === 'ai_failed') throw new Error(doc.error || 'AI processing failed');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Processing timeout');
}

const processedDoc = await waitForProcessing(doc.id);
```

**Python:**
```python
import time

def wait_for_processing(doc_id, max_attempts=30):
    for _ in range(max_attempts):
        response = requests.get(f'http://localhost:3000/api/documents/{doc_id}')
        doc = response.json()
        
        if doc['status'] == 'processed':
            return doc
        if doc['status'] == 'ai_failed':
            raise Exception(doc.get('error', 'AI processing failed'))
        
        time.sleep(2)
    raise Exception('Processing timeout')

processed_doc = wait_for_processing(doc['id'])
```

### Step 4: Fill in Missing Fields (if any)

After processing, check if there are pending fields that need user input.

**curl:**
```bash
# Check pending fields
curl -s http://localhost:3000/api/documents/{id} | jq '.pending'

# Set field values
curl -X PUT http://localhost:3000/api/documents/{id}/fields \
  -H "Content-Type: application/json" \
  -d '{"addressee": "Иванову И.И.", "authorName": "Петров П.П."}'
```

**JavaScript:**
```javascript
if (processedDoc.pending && processedDoc.pending.length > 0) {
  // User needs to fill in these fields
  console.log('Pending fields:', processedDoc.pending);
  
  // Set field values
  await fetch(`http://localhost:3000/api/documents/${doc.id}/fields`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      addressee: 'Иванову И.И.',
      authorName: 'Петров П.П.'
    })
  });
}
```

**Python:**
```python
if processed_doc.get('pending'):
    print('Pending fields:', processed_doc['pending'])
    
    requests.put(f'http://localhost:3000/api/documents/{doc["id"]}/fields', json={
        'addressee': 'Иванову И.И.',
        'authorName': 'Петров П.П.'
    })
```

### Step 5: Render and Download

Generate the DOCX file and download it.

**curl:**
```bash
# Render to DOCX
RENDER=$(curl -s -X POST http://localhost:3000/api/documents/{id}/render)
FILE_URL=$(echo $RENDER | jq -r '.downloadUrl')

# Download the file
curl -O http://localhost:3000$FILE_URL
```

**JavaScript:**
```javascript
// Render
const renderResponse = await fetch(`http://localhost:3000/api/documents/${doc.id}/render`, {
  method: 'POST',
  credentials: 'include'
});
const renderResult = await renderResponse.json();

// Download
const downloadResponse = await fetch(`http://localhost:3000${renderResult.downloadUrl}`, {
  credentials: 'include'
});
const blob = await downloadResponse.blob();

// Save file (browser)
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = renderResult.filename;
a.click();
```

**Python:**
```python
# Render
render_response = requests.post(f'http://localhost:3000/api/documents/{doc["id"]}/render')
render_result = render_response.json()

# Download
download_response = requests.get(f'http://localhost:3000{render_result["downloadUrl"]}')

# Save file
with open(render_result['filename'], 'wb') as f:
    f.write(download_response.content)
print(f"File saved: {render_result['filename']}")
```

## Full Example: Complete bash Script

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:3000"

# 1. Create document
echo "Creating document..."
DOC=$(curl -s -X POST $BASE_URL/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "sourceText": "Служебная записка\nКому: Иванову И.И.\nОт: Петров П.П.\nДата: 12.09.2026\n\nО выполнении плана\n\nНастоящим сообщаю о выполнении плана на 120%.",
    "docType": "memo",
    "templateId": "classic"
  }')
DOC_ID=$(echo $DOC | jq -r '.id')
echo "Document created: $DOC_ID"

# 2. Start processing
echo "Starting AI processing..."
curl -s -X POST $BASE_URL/api/documents/$DOC_ID/process | jq

# 3. Wait for completion
echo "Waiting for processing..."
while true; do
  STATUS=$(curl -s $BASE_URL/api/documents/$DOC_ID | jq -r '.status')
  if [ "$STATUS" = "processed" ] || [ "$STATUS" = "ai_failed" ]; then
    break
  fi
  sleep 2
done

if [ "$STATUS" = "ai_failed" ]; then
  echo "AI processing failed"
  exit 1
fi

# 4. Set fields (if needed)
echo "Setting fields..."
curl -s -X PUT $BASE_URL/api/documents/$DOC_ID/fields \
  -H "Content-Type: application/json" \
  -d '{"addressee": "Иванову И.И.", "authorName": "Петров П.П."}' | jq

# 5. Render
echo "Rendering DOCX..."
RENDER=$(curl -s -X POST $BASE_URL/api/documents/$DOC_ID/render)
FILE_URL=$(echo $RENDER | jq -r '.downloadUrl')
FILENAME=$(echo $RENDER | jq -r '.filename')

# 6. Download
echo "Downloading..."
curl -O $BASE_URL$FILE_URL
echo "Done! File: $FILENAME"
```

## Full Example: JavaScript (Node.js)

```javascript
const BASE_URL = 'http://localhost:3000';

async function generateDocument() {
  // 1. Create document
  console.log('Creating document...');
  const createResponse = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      sourceText: `Служебная записка
Кому: Иванову И.И.
От: Петров П.П.
Дата: 12.09.2026

О выполнении плана

Настоящим сообщаю о выполнении плана на 120%.`,
      docType: 'memo',
      templateId: 'classic'
    })
  });
  const doc = await createResponse.json();
  console.log('Document created:', doc.id);

  // 2. Start processing
  console.log('Starting AI processing...');
  await fetch(`${BASE_URL}/api/documents/${doc.id}/process`, {
    method: 'POST',
    credentials: 'include'
  });

  // 3. Wait for processing
  console.log('Waiting for processing...');
  let processedDoc;
  for (let i = 0; i < 30; i++) {
    const response = await fetch(`${BASE_URL}/api/documents/${doc.id}`, {
      credentials: 'include'
    });
    processedDoc = await response.json();
    
    if (processedDoc.status === 'processed') break;
    if (processedDoc.status === 'ai_failed') {
      throw new Error(processedDoc.error || 'AI processing failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 4. Set fields if needed
  if (processedDoc.pending?.length > 0) {
    console.log('Setting fields...');
    await fetch(`${BASE_URL}/api/documents/${doc.id}/fields`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        addressee: 'Иванову И.И.',
        authorName: 'Петров П.П.'
      })
    });
  }

  // 5. Render
  console.log('Rendering DOCX...');
  const renderResponse = await fetch(`${BASE_URL}/api/documents/${doc.id}/render`, {
    method: 'POST',
    credentials: 'include'
  });
  const renderResult = await renderResponse.json();

  // 6. Download
  console.log('Downloading...');
  const downloadResponse = await fetch(`${BASE_URL}${renderResult.downloadUrl}`, {
    credentials: 'include'
  });
  const buffer = await downloadResponse.arrayBuffer();
  
  // Save file (Node.js)
  const fs = require('fs');
  fs.writeFileSync(renderResult.filename, Buffer.from(buffer));
  console.log(`Done! File: ${renderResult.filename}`);
}

generateDocument().catch(console.error);
```

## Full Example: Python

```python
import requests
import time

BASE_URL = 'http://localhost:3000'

def generate_document():
    # 1. Create document
    print('Creating document...')
    create_response = requests.post(f'{BASE_URL}/api/documents', json={
        'sourceText': '''Служебная записка
Кому: Иванову И.И.
От: Петров П.П.
Дата: 12.09.2026

О выполнении плана

Настоящим сообщаю о выполнении плана на 120%.''',
        'docType': 'memo',
        'templateId': 'classic'
    })
    doc = create_response.json()
    print(f'Document created: {doc["id"]}')

    # 2. Start processing
    print('Starting AI processing...')
    requests.post(f'{BASE_URL}/api/documents/{doc["id"]}/process')

    # 3. Wait for processing
    print('Waiting for processing...')
    for _ in range(30):
        response = requests.get(f'{BASE_URL}/api/documents/{doc["id"]}')
        processed_doc = response.json()
        
        if processed_doc['status'] == 'processed':
            break
        if processed_doc['status'] == 'ai_failed':
            raise Exception(processed_doc.get('error', 'AI processing failed'))
        
        time.sleep(2)

    # 4. Set fields if needed
    if processed_doc.get('pending'):
        print('Setting fields...')
        requests.put(f'{BASE_URL}/api/documents/{doc["id"]}/fields', json={
            'addressee': 'Иванову И.И.',
            'authorName': 'Петров П.П.'
        })

    # 5. Render
    print('Rendering DOCX...')
    render_response = requests.post(f'{BASE_URL}/api/documents/{doc["id"]}/render')
    render_result = render_response.json()

    # 6. Download
    print('Downloading...')
    download_response = requests.get(f'{BASE_URL}{render_result["downloadUrl"]}')
    
    with open(render_result['filename'], 'wb') as f:
        f.write(download_response.content)
    print(f'Done! File: {render_result["filename"]}')

if __name__ == '__main__':
    generate_document()
```

## Handling Async Processing

The `/process` endpoint returns immediately with a job ID. To wait for completion:

```javascript
// Poll pattern
async function waitForProcessing(docId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/documents/${docId}`, {
      credentials: 'include'
    });
    const doc = await response.json();
    
    if (doc.status === 'processed') return doc;
    if (doc.status === 'ai_failed') throw new Error(doc.error);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Processing timeout');
}
```

## Error Handling

Common errors and how to handle them:

| Error Code | HTTP Status | Meaning | How to Handle |
|------------|-------------|---------|---------------|
| `NOT_FOUND` | 404 | Document doesn't exist | Check document ID |
| `FORBIDDEN` | 403 | Wrong cookie/owner | Ensure same session cookie |
| `BUSY` | 409 | Document is processing | Wait and retry |
| `VALIDATION_ERROR` | 400 | Invalid input | Check required fields |
| `DRAFT_EMPTY` | 400 | No draft text | Provide sourceText |
| `DRAFT_TOO_LONG` | 400 | Draft > 20,000 chars | Shorten draft |
| `NOT_READY` | 409 | No processed version | Run /process first |
| `UNKNOWN_TYPE` | 400 | Invalid docType | Use: memo, report, reference, letter |
| `UNKNOWN_TEMPLATE` | 400 | Invalid templateId | Use: classic, modern |
| `RATE_LIMITED` | 429 | Too many requests | Wait and retry |

## Integration with Telegram Bots

The DocxGen backend is designed for multi-client use. For Telegram bot integration:

1. **Use the same API** — Bot adapters call the same DocumentService as REST API
2. **Ownership model** — Each bot user gets a unique owner ID (e.g., `vk:<user_id>`, `max:<user_id>`)
3. **Webhook handling** — Bots send updates to webhook endpoints
4. **File delivery** — Bot adapters upload files to messenger platforms

For detailed bot architecture, see [plan-backend.md](../plan-backend.md).

## Integration with Web Frontends

1. **Cookie-based sessions** — Use `credentials: 'include'` in fetch requests
2. **CORS** — Server allows same-origin requests; for cross-origin, configure `PUBLIC_URL`
3. **File downloads** — Use Blob URLs for browser downloads
4. **Progress tracking** — Poll document status for real-time updates

## Rate Limiting

Mutating routes (POST/PUT/PATCH/DELETE) are limited to **30 requests per minute per IP**.

Headers included in every response:
- `X-RateLimit-Limit`: Max requests per window
- `X-RateLimit-Remaining`: Requests left in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

## Further Reading

- [API Reference](api.md) — Complete endpoint documentation
- [Architecture](../plan-backend.md) — System design and implementation details