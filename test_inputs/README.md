# Test Inputs

Example documents for testing DocxGen.

## Files

| File | Type | Tests |
|------|------|-------|
| `01_sluzhebnaya_with_errors.txt` | Служебная записка | All fields present, minor style issues |
| `02_dokladnaya_complete.txt` | Докладная записка | All fields present, formal style |
| `03_informacionnaya_missing_date.txt` | Информационная справка | Missing date field (validation test) |
| `04_pismo_formal.txt` | Письмо | All fields, includes number |
| `05_sluzhebnaya_dirty_draft.txt` | Служебная записка | Dirty draft with slang, mixed languages |

## How to Use

1. Open the app at `http://localhost:5173`
2. Copy the content from any `.txt` file (skip the "Тип:" line)
3. Select the matching document type
4. Select a template (Официальный or Стандартный)
5. Click "Сгенерировать"

## What to Check

- [ ] AI corrects spelling/grammar errors
- [ ] AI extracts requisites (Кому, От кого, etc.)
- [ ] Missing fields marked as [Заполнить]
- [ ] Document opens in Microsoft Word
- [ ] Formatting matches selected template
- [ ] Russian text displays correctly
