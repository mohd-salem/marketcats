# MA-Cats — AI Product Categorization

MA-Cats turns a **Helium 10 / Amazon product research export** into a fully categorized dataset. Upload a CSV or Excel file, let Claude Sonnet suggest categorization dimensions, approve and tweak them, then run AI categorization across all products. Results are viewable in a web dashboard and exportable to Excel (original columns preserved + new AI columns appended).

---

## Architecture

```
MA-Cats/
├── backend/          FastAPI + SQLAlchemy (SQLite) + Anthropic SDK
└── frontend/         React + TypeScript + Vite + TailwindCSS
```

### Key design decisions

| Concern | Choice |
|---|---|
| AI provider | Claude Sonnet 4.6 via Anthropic SDK (abstracted — OpenAI stub ready) |
| Database | SQLite (zero-config for MVP) |
| File parsing | pandas (CSV + Excel) |
| Excel export | openpyxl (preserves original + appends styled AI columns) |
| Background jobs | asyncio tasks inside FastAPI process |
| State management | TanStack Query (React Query) |

---

## Quick start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# Run dev server
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

Open http://localhost:5173

---

## Workflow

1. **Create project** — give it a name and optional description
2. **Upload file** — drop a Helium 10 CSV or Excel export (up to 50 MB)
3. **Target product** *(optional)* — provide ASIN, description, main function, and exclusion rules for better AI context
4. **Dimensions** — click "AI suggest dimensions" to get 6 Claude-generated categorization dimensions, or add them manually. Edit taxonomy values, then **approve** the ones you want used
5. **Run categorization** — products are processed in batches of 10; progress updates in real time
6. **Results** — browse the categorized table in the dashboard
7. **Export Excel** — downloads your original file with AI category columns appended (highlighted in blue)

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `claude` | `claude` or `openai` |
| `ANTHROPIC_API_KEY` | — | Required for Claude |
| `CLAUDE_MODEL` | `claude-sonnet-4-5` | Claude model name |
| `OPENAI_API_KEY` | — | Required if using OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model name |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |
| `MAX_UPLOAD_SIZE_MB` | `50` | Max upload size |
| `SAMPLE_SIZE_FOR_SUGGESTIONS` | `30` | Products sampled for dimension suggestion |
| `CATEGORIZATION_BATCH_SIZE` | `10` | Products per AI batch |

---

## Helium 10 column support

MA-Cats automatically normalises these Helium 10 column names:

`ASIN`, `Title`, `Brand`, `Price`, `Monthly Revenue`, `Monthly Sales`, `Reviews`, `Rating`, `Category`, `BSR`, `Image URL`, `Weight`, `Dimensions`, `Size Picture`, `Type`, `Product Details`

Custom column names are preserved as-is and still passed to the AI.

---

## Adding a new AI provider

1. Create `backend/app/services/ai/myprovider.py` implementing `AIProvider` (see `base_provider.py`)
2. Register it in `factory.py`
3. Set `AI_PROVIDER=myprovider` in `.env`

---

## Roadmap

- [ ] Phase 2: optional Amazon URL scraping for enriched product data
- [ ] Drag-and-drop dimension reordering
- [ ] Per-dimension value distribution charts
- [ ] Multi-user / auth support
- [ ] Docker Compose deployment
