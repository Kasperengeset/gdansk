// Oppretter tabellene i produksjonsdatabasen og legger inn postene fra PDF-en (bare hvis tom).
// Bruk: DATABASE_URL=postgresql://… npm run db:setup   (eller legg DATABASE_URL i .env.local)
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mangler. Se README.md.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(readFileSync("db/schema.sql", "utf8"));
  const { rows } = await client.query("select count(*)::int as n from posts");
  if (rows[0].n === 0) {
    await client.query(readFileSync("db/seed.sql", "utf8"));
    console.log("Tabeller opprettet og poster fra PDF-en lagt inn.");
  } else {
    console.log(`Tabellene er oppdatert. Fant ${rows[0].n} poster fra før, så startinnholdet ble ikke lagt inn på nytt.`);
  }
} finally {
  await client.end();
}
