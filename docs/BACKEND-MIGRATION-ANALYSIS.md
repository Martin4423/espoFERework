# Analýza: přepis UI pro ViaCRM backend (.NET)

Stav k 2026-10-25. Zdroje: `viacrm-fe` (React 19 + TS, Vite) a kontrakt backendu `viacrm-be/docs/contract/*` (m0–m9, OpenAPI overlay v `src/ViaCrm.Api/Features/OpenApi`).

## 1. Shrnutí

Dnešní UI je klient **EspoCRM** a je s ní svázaný ve třech vrstvách:

1. **Transport a auth** – `Espo-Authorization` base64 hlavička, `/api/v1/<PascalCase>/...`, chyby v `X-Status-Reason`.
2. **Datový model** – UI se řídí Espo metadaty (`/Metadata` ~850 kB, `/I18n`, `/User/:id/acl`). 170× `metadata.entityDefs`, 72× `clientDefs`, 76× `scopes`, 68× `userAcl`. Vztahy jako `xId/xName/xIds/xNames/xColumns` (218× `…Ids`, 137× `…Names`).
3. **Funkce** – velká část UI nemá na novém backendu protějšek (e-mail, kampaně, portály, 2FA, rozšíření, dashlety, formula…).

Backend je záměrně **jiný produkt** (`CHANGES-FROM-ESPO.md`): vlastní REST `/v1/records/{entity}`, Bearer JWT s refresh tokenem, problem+json, kurzorové stránkování, JSON filtr DSL, vlastní meta formát (`/v1/meta/entities`, layouty list/detail), `link` jako `<key>Id` (+ `expand`), `teamIds`, ETag/If-Match, SSE.

**Závěr:** nejde o „úpravu endpointů“. Datová vrstva a shell se musí napsat znovu. Zhruba 60 % kódu (e-mail, kampaně, admin nástroje) se maže, ne portuje. Znovupoužitelný je hlavně vizuální základ (`index.css`, ikony, dialogy, pomocné komponenty, editory polí).

Velikost: 22 410 řádků, z toho `App.tsx` 7 302 (150 funkcí/komponent v jednom souboru), `index.css` 3 904, `espoIconClasses.ts` 1 560.

## 2. Co backend nabízí (cílový kontrakt)

| Oblast | Endpointy |
|---|---|
| Auth | `POST /v1/auth/login {email,password}`, `/auth/refresh {refreshToken}`, `/auth/logout`; access JWT 15 min, refresh 14 dní rotující; 429 `TOO_MANY_ATTEMPTS` + `Retry-After` |
| Já | `GET/PATCH /v1/me` (jen `firstName`,`lastName`), `POST /v1/me/password`, `GET /v1/me/permissions` |
| Správa | `/v1/users` (+activate/deactivate/password/teams/roles), `/v1/teams` (+members/roles), `/v1/roles` – **jen admin** |
| Schéma | `GET /v1/meta/entities[/{key}]` (ETag), admin: POST/PATCH entity, `/fields` CRUD + restore/purge |
| Layouty | `GET /v1/meta/entities/{key}/layouts` → `{list:{columns,sort}, detail:{sections[{title,columns,rows}]}}`, admin PUT/DELETE `/layouts/{list\|detail}` |
| Záznamy | `GET/POST /v1/records/{entity}`, `GET/PATCH/DELETE …/{id}`, `POST …/bulk` (delete/update ≤200), `…/restore`, `…/purge` (admin), `…/history` |
| Seznam | `limit(1–200) sort(≤3) filter(JSON DSL) q cursor expand total deleted` → `{items,nextCursor,total?}` |
| Uložené filtry | `/v1/saved-filters` |
| Spolupráce | `…/{id}/notes`, `/v1/notes/{id}`, `…/followers`, `PUT/DELETE …/follow`, `/v1/notifications` (+unread-count, `POST /read`) |
| Realtime | `GET /v1/events` (SSE, `Authorization` **jen v hlavičce**, max 5 streamů/uživatel) |
| Soubory | `POST/GET /v1/records/{e}/{id}/files` (multipart, 25 MB), `/v1/files/{id}`, `/content` |
| Aktivity | entity `task`, `call`, `meeting`; `GET /v1/calendar?from&to&entities` (max 93 dní) |
| Prodej | entity `lead`, `deal`, `product`, `quote`, `quoteLine`; `POST /v1/records/lead/{id}/convert`; součty nabídek server-side |
| Automatizace | `/v1/workflows` CRUD (admin) |
| Import | `POST /v1/import/{entity}` (admin, JSON, ne CSV) |
| Ostatní | `GET /v1/openapi.json`, `/v1/health` |

Entity: `account, contact, lead, deal, product, quote, quoteLine, task, call, meeting` + runtime entity. Typy polí: `string text integer decimal boolean date dateTime enum multiEnum email phone url link` (+ systémové `id`, `idList`).

Žádné CORS → UI musí běžet **same-origin** přes proxy (nginx/Vite `/v1`).

## 3. Změny kontraktu dopadající na UI

| Téma | Espo (dnes) | ViaCRM | Dopad |
|---|---|---|---|
| Base URL | `/api/v1/Account` | `/v1/records/account` | URL builder, mapování Espo scope → klíč (`Opportunity`→`deal`) |
| Auth | Basic-like `Espo-Authorization`, token v localStorage, 401 = logout | `Authorization: Bearer`; 401 → refresh → retry; login přes **e-mail** | přepsat `api.ts` login/restore/request, `Login` komponentu (pole „uživatel“ → e-mail) |
| Chyby | `X-Status-Reason`, `body.message` | `application/problem+json` `{code,title,detail,errors[{field,code,message}]}` | jeden normalizer; chyby polí napojit na formulář |
| Stránkování | `offset/maxSize` + `total` | kurzor `nextCursor`, `total` jen `?total=true` | 62× `maxSize`, 10× `offset=`; „strana X z Y“ nelze bez total; skok na stranu N nejde (jen další) |
| Řazení | `orderBy`/`order` | `sort=-createdAt,name` (≤3, nelze link/multiEnum) | přepsat sort UI |
| Filtry | `where[]`, `primaryFilter`, `boolFilterList`, `textFilter` (92×) | `filter` JSON DSL + `q` | přepsat filter builder; presety → saved filters |
| Vztahy | `accountId`+`accountName`, `teamsIds`+`teamsNames`+`teamsColumns`, `parentType/parentId` | `accountId`; názvy přes `expand=account` (jen n:1); `teamIds` (jen ID); **žádný polymorfní parent**; n:n jen teams | přepsat link/linkMultiple/linkParent pole (30+23 výskytů), relation panely (`RecordRelationships`) |
| Čas | `YYYY-MM-DD HH:MM:SS` bez zóny | RFC 3339 UTC, 6 desetinných míst | `timeZone.ts`, všechna dateStart/dateEnd (85×) |
| Decimal/měna | `amount` + `amountCurrency` | `decimal` jako **string** (`"12.50"`), `currency` je běžný enum | `currency` field typ zmizí, hodnoty formátovat klientem |
| Update | PUT/PATCH, neznámá pole ignorována | PATCH merge patch; neznámé pole = 400; `If-Match` ETag → 412 | nový dialog „záznam byl změněn“ |
| Mazání | `deleted` flag | měkké mazání = 404; koš `?deleted=true`, `restore`, `purge` | koš jako samostatný pohled |
| Oprávnění | ACL tabulka scope→{read,edit,delete,create} | `/v1/me/permissions` `{isAdmin,entities,fields,features}`; **bez per-record flagů** | `aclLevel/canXxx` přepsat; per-record edit/delete lze jen odhadnout z `ownerId`/`teamIds` + scope (nebo požádat BE o `_permissions`) |
| Bulk | `/MassAction` | `POST …/bulk`, výsledek per id | progress/výsledková tabulka |
| Realtime | polling/WS | SSE přes **hlavičku** → `EventSource` nelze, nutný `fetch` stream reader | nová vrstva |
| Soubory | `Attachment` + chunk upload + pole `file/image/attachmentMultiple` | upload k záznamu (multipart), žádné pole typu soubor | přepsat `AttachmentCenter`, `FileAttachmentDisplay`, `uploadAttachment`; avatar/obrázkové pole odpadá |
| Stream | `Note` + `/Stream` + reakce, pin, audience | `notes` (text + mentions), `history` (audit změn polí) | `RecordStream` rozdělit na Poznámky + Historie; reakce/pin/post typy zmizí |

## 4. Mapa UI → backend (co s kterým souborem)

Legenda: **PORT** = přepsat na nové API a zachovat funkci · **KEEP** = beze změny/skoro · **DROP** = smazat (není na BE) · **LATER** = chce backend rozšíření.

### 4.1 Jádro (PORT, nutné jako první)
| Soubor | Poznámka |
|---|---|
| `api.ts` (312 ř.) | nový klient: Bearer+refresh, problem+json, URL builder. Generovat typy z `/v1/openapi.json`. `fetchMetadata` → `meta/entities` + `me` + `me/permissions` + layouty. `getListFields/getFormFields/getEditorFields` jedou na jiném formátu polí |
| `App.tsx` – `App`, `Login`, `Workspace` (shell) | rozdělit na soubory; odstranit portál/2FA/veřejné stránky; navigace = entity z `/meta/entities` (ne `scopes.tab`) |
| `App.tsx` – `EntityView` (~1 000 ř.) | seznam: layout `list.columns`, cursor, filter, saved filters, bulk, koš; kanban jen nad `enum` polem (pořadí sloupců nelze persistovat) |
| `App.tsx` – `RecordDrawer`, `RecordEditor`, `FieldInput`, `RecordFieldDisplay` | detail/formulář ze `detail.sections`; vyhodit ~40 typů polí (personName, address, currency, rangeX, duration, barcode, array*, urlMultiple, wysiwyg, colorpicker, datetimeOptional…) – zůstane 13 typů |
| `CalendarView`, `MeetingScheduler`, `MeetingAcceptanceDialog` | `GET /v1/calendar` pro čtení, vytvoření přes `POST /records/meeting\|call\|task`; pozvánky/akceptace/uživatelé na schůzce **nejsou** |
| `RecordRelationships`, `RecordActivitiesPanel`, `SelectRecordsDialog`, `LinkMultipleDisplay` | souvisle záznamy = list s `filter={field:"accountId",op:"eq"}`; n:n vazby neexistují |
| `RecordStream`, `SocialViews`, `FollowersDialog` | poznámky (+mentions), historie, follow/unfollow, followers |
| `GlobalSearchOverlay` | BE nemá globální hledání → paralelní `GET records/{e}?q=&limit=5` přes čitelné entity (nebo LATER: `/v1/search`) |
| `PersonalDashboard`, `ClassicDashboard`, `DashboardLayoutEditor` | dashlety nemají BE; nahradit pevným dashboardem: počty přes `?total=true&limit=1`, poslední záznamy přes `sort=-updatedAt` |
| `LeadConversion` | `POST /v1/records/lead/{id}/convert` (jiný body: `createAccount/createContact/createDeal` + overrides) |
| `UserAccount`, `AccountSessions` | jen jméno + změna hesla; preferences, 2FA, sessions, login history odpadá (LATER: seznam sessions) |
| `Admin*` – users/teams/roles | `RoleAclEditor`, `RoleFieldAcl` přepsat na `entityPermissions/fieldPermissions/featurePermissions` |
| `AdminEntityManager`, `AdminFieldManager`, `AdminLayoutManager` | napojit na `/meta/entities`, `/fields`, `/layouts`; omezit na 13 typů polí; vztahy = `link` pole; layouty jen list/detail |
| `ImportCenter` | BE importuje JSON (`/v1/import/{entity}`), ne CSV; buď převod CSV→JSON v prohlížeči, nebo DROP |
| `ExportDialog`, `MergeRecordsDialog`, `CurrencyConversionDialog`, `DuplicateCheckDialog` | **LATER/DROP** (BE nemá export, merge, měny, duplicity) |
| `PortalHome`, `PopupReminderToasts`, `LastViewedView`, `ActionHistoryCenter`, `CategoryNavigation`, `CategoryTreeDialog` | DROP (bez BE) |

### 4.2 DROP – celé funkční bloky bez protějšku
- E-mail: `EmailInbox`, `EmailDrawer`, `EmailComposer`, `EmailAttachmentsDialog`, `EmailEmlImportDialog`, `MailFolderField`, `EmailInsertFieldDialog`, `SettingsEmailAddressField` (~2 600 ř.).
- Kampaně / hromadné e-maily / tracking / unsubscribe / lead capture / opt-in / event confirmation / password recovery veřejné stránky (`Public*` v `App.tsx`, `CampaignMailMergeAction`, `Campaign*Panel`, `LeadCapture*`, `EmailTemplate*`).
- Portály: `PortalHome`, `PortalScopeListEditor`, `fetchPublicBranding`, portal branding v `Workspace`.
- Auth: 2FA, LDAP, OAuth, externí účty, auth tokeny, OIDC (`AdminAuthentication`, `OAuthConnectionPanel`, `ExternalAccounts`, `OAuthAuthorizationParams`, `AdminAuthTokens`, `AdminUserLoginHistory`).
- Platforma Espo: rozšíření/balíčky (`AdminPackages`, `ExtensionLicenseDialog`), `AdminLabelManager`, `AdminTemplateManager`, `AdminIntegrations`, `AdminSystemTools`, `AdminFormulaSandbox`, `AdminEntityFormula`, `FormulaFieldEditor`, `DynamicLogicEditor`, `dynamicLogicRuntime`, `ComplexExpressionInput`, `AdminTabListEditor`, `DashboardTemplateDeploy`, `PersonalDataDialog` (data privacy), `AboutDialog`, `CssCodeEditor`, `espoIconClasses.ts` (1 560 ř. mapa Espo ikon).
- Závislosti k odebrání: `ace-builds`, `cronstrue`, `jsbarcode`, `qrcode`, `marked`/`dompurify` (až po rozhodnutí o rich textu), případně `lucide-react` vs. Font Awesome (nechat jednu sadu).

### 4.3 KEEP (vizuální a obecný základ)
`index.css`, `Icons.tsx`, `ConfirmDialogProvider`, `useDialogFocus`, `ImagePreviewDialog`, `ImageCropDialog` (jen pokud bude avatar), `phoneCountries.ts`, `timeZone.ts` (upravit formát), `dashboardGrid.ts` (pokud zůstane mřížka), část CSS tříd.

### 4.4 PHP bridge a infrastruktura
- `packages/viacrm-frontend-bridge` + 7 ZIPů + `packages/viacrm-frontend` + `scripts/package-frontend-extension.sh` → **smazat celé**. Bridge existuje, protože Espo nemá endpointy pro veřejné formuláře/session list/branding; nový BE tyto funkce nemá, takže nemá co nahradit. (Lead capture, unsubscribe, RSVP, password recovery = **nová BE práce**, pokud je produkt potřebuje.)
- `frontend/nginx.conf`: odstranit `loginAs`, `LogoImage`, `CampaignTrackOpened`, `/client/`; `/api/` → `proxy_pass http://viacrm-api:<port>/v1/` (nebo přejmenovat prefix na `/v1`). Zachovat `client_max_body_size` (upload 25 MB) a **vypnout buffering pro `/v1/events`** (`proxy_buffering off`, dlouhý `read_timeout`).
- `docker-compose.yml`: EspoCRM + MariaDB → `viacrm-be` API + Postgres 17 (`tools/dev/compose.yml` v BE repu). Env `Auth__SigningKey`, `Bootstrap__AdminEmail/Password`.
- `vite.config.ts`: proxy `/v1` místo `/api` a `/client`.
- Texty „EspoCRM“ (261 výskytů `Espo` – log. názvy, `Espo` téma, `Espo-Authorization`) a loga → rebranding (BE `CLAUDE.md` přikazuje nepoužívat název/logo EspoCRM; AGPL).

## 5. Mezery na backendu, které UI okamžitě potřebuje

Při analýze vyšly najevo díry v kontraktu – bez nich bude UI nepoužitelné pro ne-admina:
1. **Seznam uživatelů pro běžné uživatele.** `/v1/users` je admin-only, ale `ownerId`, mentions, přiřazení úkolu a filtry potřebují jména. `expand` funguje jen pro `link`, ne pro `ownerId`/`createdById`. → doporučuji `GET /v1/users/lookup?q=` (id, jméno) a/nebo `expand=owner`.
2. **Názvy týmů** pro `teamIds` (`/v1/teams` admin-only) – stejné řešení.
3. **Oprávnění per záznam** (`_permissions {edit,delete}`) – dnes si UI musí scope pravidla znovu odvodit; riziko rozjetí s BE.
4. **Globální hledání** (`/v1/search?q=`).
5. **Preferences / nastavení** (jazyk, časová zóna, formát data) – `/v1/settings/*` a preference uživatele neexistují; zatím klientské (localStorage).
6. **i18n** – BE nedává texty; UI vlastní katalog (cs/en). Labely polí a entit už jsou v meta (`label`, `labelSingular`).
7. **Realtime auth** – SSE jen přes hlavičku; funguje s `fetch`, ale reconnect s `Last-Event-ID` si UI řeší samo.
8. **Přihlášení, obnova hesla, 2FA** – bez self-service resetu hesla; admin resetuje ručně.
9. **Veřejné funkce** (lead capture formulář, RSVP, unsubscribe) – nemají nic.
10. **Kanban pořadí**, **sessions list**, **export**, **sdílené soubory/dokumenty** – nejsou.
Kontrola známých follow-upů z `docs/STATUS.md` (rozhodnutí 400 vs 404 u listu, audit bez retence) UI nijak neblokuje.

## 6. Doporučený postup

**Varianta A – adaptér (nedoporučuji):** nechat `App.tsx` a vyrobit vrstvu, co přeloží nové API na Espo-tvar (`xId/xName`, `where`, ACL tabulku, metadata). Rychlý první screenshot, ale zachová 7k řádků monolit, 40 typů polí a všechny Espo-ismy; kurzor vs. offset a chybějící funkce se stejně prosadí. Vyhodíte práci dvakrát.

**Varianta B – nová aplikace po řezech (doporučuji):** nová struktura `src/{api,auth,meta,records,collab,admin,ui}`, přenést CSS/ikony/dialogy, každou obrazovku napsat nad novým klientem. Odpovídá rozhodnutí D1 „hybrid“ v BE kontraktu: **meta-řízené** obrazovky (seznam, detail, formulář, filtry, bulk, import, správa polí/layoutů) + **pevné** obrazovky (login, dashboard, kalendář, notifikace, uživatelé/role/týmy, profil).

### Řezy (každý nasaditelný a testovatelný proti běžícímu BE)
0. **Základ** – smazat bridge/Espo infrastrukturu, nový docker-compose + proxy, generovaný klient z OpenAPI, auth (login/refresh/logout), problem+json, `/me`, `/me/permissions`, `meta/entities`. Test: login → prázdný shell.
1. **Záznamy** (odpovídá `ui-slice-1.md` v BE): navigace entit, seznam (layout, sort, `q`, kurzor, `total`), detail (sections), create/edit/delete s ETag, validační chyby u polí, link výběr (lookup přes list), expand. Pilot: `account`, `contact`.
2. **Filtry, koš, bulk, saved filters**.
3. **Spolupráce**: poznámky + mentions, historie, followers, notifikace + SSE, soubory.
4. **Prodej a aktivity**: lead (convert), deal (kanban nad `stage`), quote + lines (součty read-only), task/call/meeting, kalendář.
5. **Admin**: uživatelé/týmy/role (matice oprávnění), entity/pole/layouty, workflows, import.
6. **Dashboard, profil, globální hledání, i18n, rebrand**.

Souběžně na BE (viz §5): lookup uživatelů/týmů, `_permissions`, search – nejlépe před řezem 1.

### Testování
Playwright E2E proti reálnému BE (docker compose) pro každý řez; jednotkové testy čistých funkcí (filter builder → DSL, cursor stav, formátování decimal/dateTime, mapování chyb → pole). Typy z OpenAPI hlídají drift kontraktu (CI: regenerace + `tsc`).

### Odhad rozsahu (hrubý)
Nový kód řádově 8–10 k řádků TS/TSX (dnes 22 k, z toho ~13 k se maže): shell+klient 1 k, záznamy 3 k, spolupráce 1,5 k, prodej/aktivity 1,5 k, admin 2 k, ostatní 1 k.

## 7. Rozhodnutí potřebná od vás
1. Varianta A vs. **B** (doporučeno B).
2. Zachovat jednu z funkcí bez BE (e-mail, kampaně, veřejné formuláře, portál, 2FA)? Každá = nová BE práce, ne UI.
3. Doplnit BE o `users/lookup`, `_permissions`, `search` před řezem 1?
4. Jazyk UI (cs, en, obojí) a kde žije katalog textů.
5. CSV import: konverze v prohlížeči, nebo vypustit (BE import je JSON/Espo-tvar)?
6. Kanban: stačí řazení podle `enum` bez persistence pořadí?
