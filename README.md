# ViaCRM Client — alternativa k EspoCRM 9.1.7

Tohle je React + TypeScript náhrada uživatelského rozhraní EspoCRM 9.1.7; EspoCRM zůstává backendem přes REST API. Nový klient běží na hlavním originu `8091` i vývojovém portu `5173`. Původní rozhraní EspoCRM je pro administraci a obnovu dostupné přímo na `8092`.

## Spuštění

```sh
docker compose up -d --build
```

Otevři [http://localhost:8091](http://localhost:8091) a přihlas se účtem EspoCRM. Lokální demo účet je `admin` / `admin`. Stejný nový klient je také na [http://localhost:5173](http://localhost:5173). Nativní administrační rozhraní backendu zůstává na [http://localhost:8092](http://localhost:8092).

## Aktuální rozsah klienta

- Přihlášení přes EspoCRM token a serverovou API proxy.
- Veřejná přihlašovací obrazovka přebírá název aplikace, logo a téma z nastavení EspoCRM; portálové přihlášení používá vlastní branding.
- Navigace sestavená z metadat EspoCRM.
- Globální vyhledávání přes EspoCRM API a oprávnění přihlášeného uživatele.
- Dashboard se souhrnnými počty a nedávno změněnými záznamy.
- Týdenní kalendář napojený na EspoCRM Activities API; lze otevřít i vytvořit schůzky, hovory a úkoly.
- Generické seznamy, textové hledání a stránkování pro entity dostupné v metadatech.
- Detail záznamu a formuláře pro vytvoření a úpravy; formuláře obsluhují základní typy polí, výběr vztahů, týmy a role; mazání z detailu.
- E-mailová schránka se systémovými a vlastními složkami, hledáním, hvězdičkou, hromadnými akcemi, detailem, odpovědí a přeposláním.
- CSV/TSV import s mapováním sloupců, historií a akcemi pro vrácení importu a odstranění duplicit.
- Administrativní rozcestník s uživateli, týmy, rolemi, poštovními účty, importem a systémovými nastaveními (dostupnost položek závisí na API a oprávněních účtu).
- Jednotná sada Font Awesome ikon v navigaci, administraci, seznamech, formulářích i dialozích; metadata EspoCRM se vykreslují jejich původními třídami.
- Veřejný Lead Capture formulář, opt-in potvrzení, RSVP účasti a správa campaign unsubscribe; most obsluhuje i campaign open tracking pixel a je v balíčku `packages/ViaCRM-Frontend-Bridge-1.5.0.zip`.
- Rozložení pro desktop i mobil.

Jde stále o rozpracovanou náhradu klienta. Úplný seznam chybějících obrazovek a ověřitelných požadavků je v [COVERAGE.md](COVERAGE.md). Docker gateway nyní obsluhuje klienta na hlavním CRM originu a předává `/api` i potřebné nativní endpointy EspoCRM; samostatný PHP bridge ZIP zajišťuje serverovou logiku veřejných formulářů. Instalovatelný balíček reworku se sestaví příkazem `./scripts/package-frontend-extension.sh`; výsledný ZIP `packages/ViaCRM-Frontend-2.0.174.zip` obsahuje celý React build i API bridge a nainstaluje se přes Administrace → Rozšíření. V běžném EspoCRM běží na stejné doméně v `/client/custom/viacrm/`; nahrazení kořenové URL a nativních veřejných entrypointů vyžaduje směrování webserveru, popsané v balíčku.

## Vývoj

Zdroj je v `frontend/src`. Pro lokální Vite server použij `npm install && npm run dev`; vývojový server proxyuje `/api` na `http://localhost:8091`. Produkční statické sestavení vytvoří `npm run build` do `frontend/dist`; Docker Nginx klienta obsluhuje na portech `5173` a `8091`, zatímco `/api` a `/client` předává EspoCRM backendu, který je lokálně dostupný na portu `8092`.
