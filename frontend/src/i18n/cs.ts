// Czech catalogue. Keys are added with the screens that use them (the old screens still carry Czech text inline).
export const cs = {
  "app.name": "ViaCRM",
  "common.loading": "Načítám…",
  "common.retry": "Zkusit znovu",
  "common.logout": "Odhlásit se",
  "common.language": "Jazyk",
  "unsupported.title": "Ve ViaCRM zatím není k dispozici",
  "unsupported.body": "Tato funkce zatím není v novém backendu ViaCRM implementována.",

  "login.eyebrow": "VÍTEJTE ZPĚT",
  "login.title": "Přihlášení do CRM",
  "login.hint": "Použijte svůj e-mail a heslo.",
  "login.email": "E-mail",
  "login.password": "Heslo",
  "login.showPassword": "Zobrazit heslo",
  "login.hidePassword": "Skrýt heslo",
  "login.submit": "Přihlásit se",
  "login.busy": "Ověřuji…",
  "login.secure": "Přihlášení ověřuje ViaCRM",

  "session.expired": "Vaše přihlášení vypršelo nebo bylo odvoláno. Přihlaste se znovu.",
  "session.unavailable": "CRM není dostupné. Zkuste to za chvíli znovu.",

  "home.signedInAs": "Přihlášen jako {name}",
  "home.role.admin": "administrátor",
  "home.role.regular": "uživatel",
  "home.interim": "Přihlášení funguje. Další obrazovky se zapojují postupně.",

  "error.network": "Server neodpovídá. Zkontrolujte připojení a zkuste to znovu.",
  "error.generic": "Požadavek se nezdařil ({status}).",
  "error.INVALID_CREDENTIALS": "E-mail nebo heslo nejsou správné.",
  "error.TOO_MANY_ATTEMPTS": "Příliš mnoho pokusů. Zkuste to znovu za {minutes} min.",
  "error.TOO_MANY_ATTEMPTS.soon": "Příliš mnoho pokusů. Zkuste to znovu za chvíli.",
  "error.UNAUTHENTICATED": "Je potřeba se přihlásit.",
  "error.INVALID_REFRESH_TOKEN": "Přihlášení vypršelo. Přihlaste se znovu.",
  "error.FORBIDDEN": "Na tuto akci nemáte oprávnění.",
  "error.NOT_FOUND": "Záznam nebo stránka neexistuje.",
  "error.VALIDATION_FAILED": "Zadané údaje nejsou v pořádku.",
  "error.CONFLICT": "Akce je v konfliktu s aktuálním stavem.",
  "error.PRECONDITION_FAILED": "Záznam se mezitím změnil. Načtěte ho znovu.",
  "error.PAYLOAD_TOO_LARGE": "Data jsou příliš velká.",
  "error.UNSUPPORTED_MEDIA_TYPE": "Nepodporovaný typ obsahu.",
  "error.INTERNAL": "Na serveru došlo k chybě. Zkuste to později.",
} as const;

export type MessageKey = keyof typeof cs;
