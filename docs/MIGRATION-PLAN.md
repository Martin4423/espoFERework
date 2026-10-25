# Plán: přepis `viacrm-fe` z EspoCRM kontraktu na viacrm-be

Větev `dot-net`. Navazuje na `docs/BACKEND-MIGRATION-ANALYSIS.md` (co se mění) a respektuje rozhodnutí: **stávající UI se předělává na místě**, co backend nepodporuje, ukáže hlášku „Ve ViaCRM zatím není k dispozici“. Backend M0–M10 je hotový (větev `dot-net` v `viacrm-be`, 3032 testů).

## Princip
- **Vrstva překladu (adaptér).** Nová datová vrstva mluví s `/v1/*` a překládá odpovědi na tvar, který stávající obrazovky očekávají (metadata, ACL, záznamy, chyby). Obrazovky se tak mění minimálně a běží hned.
- **Každý krok končí použitelným MVP**, které můžete vyzkoušet v prohlížeči proti reálnému backendu. Nehotové části jsou vidět jako „zatím není k dispozici“, ne jako rozbité.
- **Espo prvky se likvidují po částech.** Každý krok z adaptéru odstraní to, co už obrazovky nepotřebují (`xId/xName`, `where`, offset…). Poslední krok smaže adaptér i zbytky Espo.
- **Nepodporované funkce** řídí jeden registr (`unsupported.ts`) a jedna komponenta `NotAvailable`. Navigace, tlačítka a administrační dlaždice se k němu hlásí, takže se hláška mění na jednom místě.
- **Pojmenování entit.** Espo názvy (`Account`, `Opportunity`) se mapují na klíče backendu (`account`, `deal`) jednou tabulkou v adaptéru. Entity bez protějšku (Case, Campaign, Email, Document…) jdou do `NotAvailable`.

## Jak testujeme každý krok
- **Ručně:** seznam „co si otevřít a co má fungovat“ je u každého kroku.
- **Automaticky:** krok 0 přidá `vitest` (adaptér a čisté funkce) a `Playwright` smoke test proti reálnému backendu v dockeru. Každý krok přidá své testy; gate = `npm run lint`, `tsc -b`, `vitest`, Playwright.
- **Data:** nástroj `espo-import` už existuje; pro vývoj přibude jednoduchý seed (několik set účtů/kontaktů).

## Kroky

Odhady jsou **uplynulý pracovní čas** (ne člověkohodiny) při práci s paralelními agenty, včetně mé kontroly a oprav. Rozptyl ±50 %; největší nejistota je v krocích 3–4 a 8.

| # | MVP krok | Co můžete otestovat | Odhad |
|---|---|---|---|
| **B0** | **BE: spustitelné API.** `Dockerfile`, `docker-compose` (API + Postgres), konfigurace (`Auth__SigningKey`, bootstrap admin, `Public__BaseUrl`), `scripts/run.sh`. Dnes BE nemá jak se spustit mimo testy. | `docker compose up`, `GET /v1/health`, `/v1/openapi.json`, login přes curl | 1–1,5 h |
| **S0** | **Prostředí FE.** `docker-compose` (fe + be + db, bez EspoCRM), nginx a Vite proxy `/v1`, odstranění Espo kontejnerů, `vitest` + Playwright kostra, `.env`. | `docker compose up`, FE se načte na `:5173` a `:8091`, `/v1/health` přes proxy | 2–3 h |
| **S1** | **Auth a klient.** Nový `request()` (Bearer, refresh před/po 401 s opakováním, problem+json → `ApiError`), login e-mailem, logout, obnova relace, `/v1/me`. Špatné heslo, zamčení (429 + `Retry-After`), vypršení relace. 2FA a portálové přihlášení skryté. | přihlášení/odhlášení, špatné heslo, 5 chybných pokusů → hláška o zamčení, po 15 min refresh funguje | 3–4 h |
| **S2** | **Metadata, oprávnění a shell.** Adaptér složí `Metadata` z `/v1/meta/entities`, `/v1/me/permissions`, layoutů. Mapování typů polí, ACL tabulka, navigace jen z entit backendu, registr nepodporovaného. Prázdné obrazovky entit. | menu s Účty, Kontakty, Leady, Obchody, Úkoly, Hovory, Schůzky, Produkty, Nabídky; omezený uživatel vidí jen své entity; Email/Kampaně/… ukážou „zatím není k dispozici“ | 5–7 h |
| **B1** | **BE: lookup uživatelů a týmů** pro ne-adminy (`GET /v1/users/lookup`, názvy týmů) a `expand` pro `ownerId`/`createdById`. Bez toho nejdou jména vlastníků, výběr přiřazeného a zmínky. | curl jako běžný uživatel: seznam jmen; záznam s rozbaleným vlastníkem | 2–3 h |
| **S3** | **Seznamy.** Sloupce z list layoutu, kurzorové stránkování (další/předchozí, bez čísel stránek), řazení, hledání `q`, počet (`total`), zobrazení polí podporovaných typů, vazby přes `expand`. | seznamy účtů a kontaktů, hledání, řazení, projetí 1000 záznamů, vlastník jménem | 5–7 h |
| **S4** | **Detail, vytvoření, úprava, smazání.** Detail z detail layoutu, formulář podle typů, `PATCH` s `If-Match` + dialog „záznam se mezitím změnil“ (412), chyby polí z `errors[]` k polím, výběr vazeb (lookup), měkké smazání. | plný CRUD účtu a kontaktu; validace (povinné, e-mail, délka); souběžná úprava ve dvou oknech | 7–9 h |
| **S5** | **Filtry, koš, hromadné akce, související záznamy.** Filtr builder → JSON DSL, uložené filtry, koš (obnovit/smazat navždy), hromadné smazání/úprava s výsledkem po záznamech, panel souvisejících záznamů. | filtr „stage = won AND amount > …“, uložit/načíst, koš, označit 20 a hromadně změnit | 6–8 h |
| **S6** | **Spolupráce.** Poznámky + zmínky, historie změn, sledující, zvonek s notifikacemi, SSE přes `fetch` s `Last-Event-ID`, soubory u záznamu (upload/stažení). | napsat poznámku se zmínkou → druhému uživateli přijde notifikace živě; historie ukáže změny polí; nahrát soubor | 7–9 h |
| **S7** | **Prodej a aktivity.** Převod leadu (`/convert`), kanban obchodů nad `stage`, nabídky s řádky (součty jen čtení), úkoly/hovory/schůzky, kalendář z `/v1/calendar`. Pozvánky a účastníci: hláška. | převést lead na účet+kontakt+obchod; přetáhnout obchod mezi fázemi; nabídka se součtem; kalendář týdne | 7–10 h |
| **S8** | **Administrace.** Uživatelé, týmy, role (matice oprávnění entit/polí/funkcí), správce entit a polí (13 typů), layouty list/detail, workflows (seznam, zapnout/vypnout, editor), import (JSON/CSV převod). Ostatní dlaždice: hláška. | vytvořit uživatele, roli, tým; přidat pole `Priority` do účtu a hned ho vidět ve formuláři; upravit layout | 9–13 h |
| **S9** | **Veřejné stránky a účet (náhrada bridge).** Login s brandingem a volbami přihlášení, zapomenuté a nové heslo (`/reset-password`), veřejný lead formulář (`/forms/{id}`) a potvrzení (`/lead-confirm`), stránka zabezpečení účtu (sessions, historie, změna hesla), admin branding a lead formuláře. | celý recovery cyklus s mailem (Mailpit v dockeru), odeslání veřejného formuláře → lead, odhlášení ostatních zařízení | 6–8 h |
| **S10** | **Dashboard, globální hledání, profil, úklid.** Pevný dashboard (počty, poslední záznamy), globální hledání přes čitelné entity, profil a preference (jazyk, zóna v localStorage), smazání adaptéru a Espo zbytků (`espoIconClasses`, nginx entrypointy, `packages/viacrm-frontend`), rebrand bez názvu a loga EspoCRM, audit `NotAvailable`. | celá aplikace bez zbytků Espo; `grep -ri espo` čisté kromě poznámky o importu | 7–10 h |

**Celkem:** asi 70–95 hodin uplynulého času, tedy zhruba **8–12 pracovních dní**, pokud se rozhodnutí nezdržují. Použitelný první celek (přihlášení, seznamy, detail, CRUD účtů a kontaktů = **B0 až S4**) je za cca **2–3 pracovní dny**.

## Pořadí a závislosti
`B0 → S0 → S1 → S2 → B1 → S3 → S4 → S5`; poté `S6`, `S7`, `S8`, `S9` lze dělat v libovolném pořadí nebo souběžně (nezávisí na sobě); `S10` až nakonec. B1 se může dělat souběžně s S2.

## Rizika
1. **Adaptér vs. Espo tvar.** `App.tsx` má 7 300 řádků a 170 odkazů na `entityDefs`. Odhady S2–S4 počítají s tím, že stačí překládat; pokud se ukáže, že některé obrazovky (zejména `FieldInput`) jsou k Espo typům přilepené, S4 poroste o 1–2 dny. Rozhodnu po S2.
2. **Mezery backendu:** lookup uživatelů (B1), oprávnění per záznam (zatím odhad z `ownerId`/`teamIds` a scope), globální hledání (S10 je řeší na klientu). Pokud některá vadí víc, přidáme BE krok.
3. **Kurzorové stránkování** mění obsluhu „strana X z Y“ a přeskočení na stránku; MVP má jen další/předchozí.
4. **Bez testů dnes.** FE nemá žádné; kostra přibude v S0, ale pokrytí starého kódu nedoháníme, testuje se jen to, co se mění.
5. **Zátěž stroje:** celé BE testy běžely 3× déle při load average ~40; E2E v prohlížeči poběží pomaleji.

## Rozhodnutí, která potřebuji
1. Souhlas s pořadím a s **B0 + B1** jako BE kroky navíc.
2. Jazyk UI: zůstane čeština a angličtina z Espo katalogu, nebo jen čeština? (Texty z Espo `I18n` backend nedodává, katalog se musí vzít z FE.)
3. Veřejné lead formuláře a recovery mail: stačí Mailpit pro vývoj?
