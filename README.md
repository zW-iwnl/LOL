# Test Manager

Interní webová aplikace pro správu test cases, test suites, test runs, výsledků testování a defectů.

Podrobné funkční zadání, vysvětlení procesů a diagramy jsou v dokumentu
[`docs/zadani-a-architektura.md`](docs/zadani-a-architektura.md).

Produkční nasazení na vlastní Linux server popisuje
[`docs/linux-deployment.md`](docs/linux-deployment.md).

## Stack

- Backend: Python FastAPI
- ORM: SQLAlchemy
- Migrace: Alembic
- Databáze: PostgreSQL
- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS
- Lokální běh: Docker Compose

## Lokální spuštění

1. Vytvoř lokální `.env` podle šablony:

```powershell
Copy-Item .env.example .env
```

2. Spusť aplikaci:

```powershell
docker compose up --build
```

3. Otevři služby:

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/health
- OpenAPI: http://localhost:8000/docs

## Vývoj bez Dockeru

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Databázové migrace

V Dockeru:

```powershell
docker compose run --rm backend alembic -c alembic.ini upgrade head
```

Lokálně z backend složky:

```powershell
cd backend
alembic -c alembic.ini upgrade head
```

## Seed demo dat

Nejdřív spusť migrace, potom založ demo data.

V Dockeru:

```powershell
docker compose run --rm backend python scripts/seed_demo.py
```

Lokálně z backend složky:

```powershell
cd backend
python scripts/seed_demo.py
```

## Produkční spuštění

Produkční konfigurace nepoužívá Vite dev server, neseeduje demo data a backend neběží s `--reload`.

1. Vytvoř produkční env soubor:

```powershell
Copy-Item .env.production.example .env.production
```

2. Uprav minimálně tyto hodnoty:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`
- `FRONTEND_PORT`

3. Spusť produkční compose:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

4. Ověř služby:

- Frontend: `http://localhost`
- Health check: `http://localhost/health`
- API přes nginx proxy: `http://localhost/api/health`

### Produkční poznámky

- `JWT_SECRET_KEY` nesmí zůstat na výchozí hodnotě.
- `SEED_DEMO_DATA=false` brání založení demo dat v produkci.
- `DOCS_ENABLED=false` vypne Swagger/OpenAPI endpointy.
- Databázi pravidelně zálohuj mimo Docker volume.
- Před reálným nasazením doplň plnohodnotné přihlášení na frontendu a role/permissions na chráněných operacích.

## Railway deployment

Na Railway nasazuj jako 3 služby:

1. `PostgreSQL` template
2. `backend` z adresáře `/backend`
3. `frontend` z adresáře `/frontend`

### Backend služba

- root directory: `/backend`
- config file: `/backend/railway.json`
- `APP_ENV=production`
- `SEED_DEMO_DATA=false`
- `DOCS_ENABLED=false`
- `PORT=8000`
- `DATABASE_URL` nech Railway napojit z PostgreSQL služby
- `JWT_SECRET_KEY` nastav ručně na silnou hodnotu

### Frontend služba

- root directory: `/frontend`
- config file: `/frontend/railway.json`
- `BACKEND_URL=http://backend.railway.internal:8000`

Frontend server na Railway proxyuje `/api` a `/health` na backend, takže pro browser stačí veřejná adresa frontend služby.

### Poznámka k proměnným

- Railway používá reference syntax `${{SERVICE_NAME.VAR}}`
- pro backend service je v projektu dobré použít přesný název služby, bez diakritiky a mezer
- pokud backend služba dostane jiný název, uprav podle něj `BACKEND_URL` na tvar `http://NAZEV_SLUZBY.railway.internal:8000`
