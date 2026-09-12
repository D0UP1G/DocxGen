# Adding a document type or template

Catalog data is loaded at startup from `packages/backend/config`.

## Document type

Add a JSON file to `packages/backend/config/doc-types` with a unique `id`, a
display `name`, an optional `hint`, and the fields required by the document:

```json
{
  "id": "notice",
  "name": "Уведомление",
  "hint": "Короткое официальное уведомление",
  "fields": [
    { "key": "recipient", "label": "Адресат", "required": true },
    { "key": "date", "label": "Дата", "required": true }
  ]
}
```

Field keys are used by AI extraction, the requisites form, validation and
template placeholders. Keep them stable after a type is released.

## Template

Add a template JSON file to `packages/backend/config/templates` and a matching
DOCX template under the configured template assets. Placeholders use the same
field keys as the document type. If a preview image is supplied, its filename
must match the template id in the previews directory.

Restart the backend after changing catalog files. Verify the result with
`GET /api/catalog`, then run the complete path: create a document, process it,
resolve pending fields, render it and download the DOCX.
