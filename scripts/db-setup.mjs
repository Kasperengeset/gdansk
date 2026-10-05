// Oppretter tabellene i produksjonsdatabasen og legger inn postene fra PDF-en (bare hvis tom).
// Bruk: DATABASE_URL=postgresql://… npm run db:setup   (eller legg DATABASE_URL i .env.local)
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler. Se README.md.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  await sql.unsafe(readFileSync("db/schema.sql", "utf8"));
  const [{ n }] = await sql`select count(*)::int as n from posts`;
  if (n === 0) {
    await sql.unsafe(readFileSync("db/seed.sql", "utf8"));
    console.log("Tabeller opprettet og poster fra PDF-en lagt inn.");
  } else {
    console.log(`Tabellene er oppdatert. Fant ${n} poster fra før, så startinnholdet ble ikke lagt inn på nytt.`);
  }
} finally {
  await sql.end();
}
