# ViaCRM Client

React + TypeScript klient pro **ViaCRM** (.NET backend `viacrm-be`). UI vzniklo jako klient EspoCRM a postupně se přepisuje na kontrakt ViaCRM; co backend zatím neumí, ukazuje hlášku „Ve ViaCRM zatím není k dispozici“. Plán a stav: [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md), co se mění a proč: [docs/BACKEND-MIGRATION-ANALYSIS.md](docs/BACKEND-MIGRATION-ANALYSIS.md).

Větev `dot-net` (do `main` se zatím nemerguje).

## Spuštění (všechno v Dockeru)

```sh
docker compose up -d --build
```

- Klient: <http://localhost:5173> (nginx, `/v1` proxyuje na API)
- Mailpit (všechny e-maily systému, např. reset hesla): <http://localhost:8025>
- Přihlášení: `admin@example.com` / `admin-dev-password-1`

Backend se staví z `../viacrm-be` (musí ležet vedle tohoto repozitáře).

## Vývoj

Backend spusť v `../viacrm-be` příkazem `scripts/run.sh` (API na `http://localhost:5080`, Mailpit na `:8025`), pak:

```sh
cd frontend
npm install
npm run dev        # Vite na http://localhost:5173, /v1 proxyuje na VITE_API_URL (výchozí http://localhost:5080)
```

Backend nemá CORS, proto klient vždy volá `/v1` na vlastním originu (Vite nebo nginx).

## Testy

```sh
cd frontend
npm run check      # tsc -b + vitest (jednotkové testy)
npm run e2e        # Playwright proti běžícímu backendu a Vite (E2E_BASE_URL přepne cíl, např. na Docker stack)
npm run lint       # oxlint (v App.tsx jsou zatím staré chyby pravidel hooků, řeší se při přepisu formulářů)
```

První spuštění E2E: `npx playwright install chromium`.
