# Gdańsk uten kart

App for rebusløpet i Gdańsk (se `rebuslop_gdansk (1).pdf`). Lagene får ledetrådene som chiffer i appen, må fysisk være på stedet (GPS) for å låse opp oppgaven, og laster opp bildebevis. Arrangøren styrer alt fra `/admin`.

## Slik fungerer løpet

1. Én på laget oppretter laget på forsiden og deler lagkoden. De andre blir med med koden og navnet sitt.
2. I lobbyen tester laget GPS-en på lagmobilen. Admin ser hvem som har testet.
3. Admin trykker **Start alle**, og klokka begynner å gå.
4. For hver post skjer dette:
   - **Ledetråd:** appen viser en kodet ledetråd. Laget knekker koden på papir og spør seg fram.
   - **«Vi er her!»:** appen sjekker posisjonen. Serveren svarer bare ja eller nei, aldri med avstand, og det går maks ett forsøk hvert 20. sekund.
   - **Oppgave:** på riktig sted vises oppgaven. Laget laster opp bilde og/eller skriftlig svar, og neste post låses opp.
   - **Nødkonvolutt:** viser stedsnavnet og gir automatisk +15 min.
   - **Reserveplan:** virker ikke GPS-en (innendørs, for eksempel Józef K), ringer laget arrangøren, som trykker **Lås opp** på lagsiden i admin.
5. Når laget sjekker inn på finalen, stopper klokka. Resultatlista i admin viser sluttid = faktisk tid + straff − bonus.

## Kjøre lokalt

```bash
npm install
npm run dev
```

- **Appen:** http://localhost:3000
- **Admin:** http://localhost:3000/admin. Lokalt er passordet `admin`, med mindre du setter `ADMIN_PASSWORD`.
- **Database:** uten `DATABASE_URL` bruker appen en innebygd database i `.data/`. Slett mappen for å starte på nytt med postene fra PDF-en.
- **Tester:** `npm test`

**Teste GPS uten å gå ut:** i Chrome DevTools, gå til ⋮ → More tools → Sensors → Location og velg en egendefinert posisjon.

## Publisere (Supabase + Vercel, begge gratis)

### 1. Database (Supabase)

1. Opprett et prosjekt på [supabase.com](https://supabase.com) og velg regionen **Central EU (Frankfurt)**.
2. Trykk **Connect** og kopier tilkoblingsstrengen under **Transaction pooler** (port 6543). Bytt ut `[YOUR-PASSWORD]` med databasepassordet.
3. Opprett tabellene og legg inn postene fra PDF-en:
   ```bash
   DATABASE_URL="postgresql://postgres.xxxx:PASSORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" npm run db:setup
   ```
   Det er trygt å kjøre kommandoen flere ganger. Postene legges bare inn hvis databasen er tom.

### 2. Hosting (Vercel)

1. Gå til [vercel.com](https://vercel.com) og logg inn med GitHub. Velg **Add New → Project** og importer repoet `gdansk`.
2. Legg inn disse miljøvariablene:
   - `DATABASE_URL`: tilkoblingsstrengen fra Supabase
   - `ADMIN_PASSWORD`: et passord du velger
   - `SESSION_SECRET`: en lang tilfeldig streng, for eksempel fra `openssl rand -base64 32`
3. Trykk **Deploy**. `vercel.json` kjører serverfunksjonene i Frankfurt, nær databasen.

## Før løpet

- **Poster:** i `/admin/poster` plasserer du hver post på kartet (adressesøk, klikk på kartet, lim inn koordinater fra Google Maps eller «Bruk min posisjon»). Skriv de endelige ledetrådene og oppgavene. Chiffervalgene i startinnholdet er bare forslag.
- **Kontaktinfo:** legg inn telefonnummeret ditt på adminoversikten. Det vises som «Ring arrangøren»-knapp for lagene.
- **Prøverunde:** opprett et testlag, start det og spill noen poster på ekte mobil. Bruk **Nullstill** på lagsiden etterpå.
- **I Gdańsk:** gå eller sykle ruten og sjekk at innsjekken virker på hver post. Øk radius der GPS er ustabil.
- **Morsetabell:** står det morse i noen ledetråd, må du skrive ut en morsetabell (med Æ, Ø og Å) til lagene.
- **Supabase-pause:** Supabase setter gratisprosjekter på pause etter en uke uten bruk, så åpne appen noen dager før løpet.

## Teknisk

- **Rammeverk:** Next.js 16 (App Router), TypeScript og Tailwind.
- **Database:** Postgres via `postgres`. Lokalt og i testene brukes PGlite. Bildene lagres i databasen.
- **Viktige filer:**
  - `lib/game.ts`: spillogikken, altså tilstand, innsjekk, bevis, nødkonvolutt og admin. Oppgavetekst, nødtekst og koordinater sendes aldri til lagene før de er låst opp.
  - `lib/cipher.ts`: chiffer over det norske alfabetet (A–Å, 29 bokstaver).
  - `db/schema.sql` og `db/seed.sql`: tabeller og startinnhold fra PDF-en.
