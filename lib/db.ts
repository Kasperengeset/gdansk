import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";

// Minimal felles grensesnitt over node-postgres (produksjon) og PGlite (lokalt/tester).
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

const SQL_DIR = path.join(process.cwd(), "db");

export function readSql(name: "schema.sql" | "seed.sql"): string {
  return readFileSync(path.join(SQL_DIR, name), "utf8");
}

type PGliteLike = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
  transaction<T>(fn: (tx: { query<R>(text: string, params?: unknown[]): Promise<{ rows: R[] }> }) => Promise<T>): Promise<T>;
};

function wrapPglite(pg: PGliteLike): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    tx(fn) {
      return pg.transaction((tx) =>
        fn({
          async query<T>(text: string, params: unknown[] = []) {
            return (await tx.query<T>(text, params)).rows;
          },
          tx: () => {
            throw new Error("Nestede transaksjoner støttes ikke");
          },
        }),
      );
    },
  };
}

/** Oppretter tabeller og legger inn startinnhold hvis databasen er tom. */
export async function migrate(exec: (sql: string) => Promise<unknown>, db: Db) {
  await exec(readSql("schema.sql"));
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from posts");
  if (n === 0) await exec(readSql("seed.sql"));
}

/** Database i minnet, til tester. */
export async function createMemoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  const db = wrapPglite(pg as unknown as PGliteLike);
  await migrate((sql) => pg.exec(sql), db);
  return db;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    // node-postgres sender aldri mer enn én spørring om gangen per tilkobling. Det krever
    // Supabase sin transaksjons-pooler, som henger hvis spørringer legges i kø (pipelining).
    // idleTimeoutMillis lukker ubrukte tilkoblinger, så frosne serverless-instanser ikke sitter med døde.
    const pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
    pool.on("error", (err) => console.error("Feil i ledig databasetilkobling:", err.message));

    const run = async <T>(client: Pick<PoolClient, "query">, text: string, params: unknown[] = []) =>
      (await client.query(text, params)).rows as T[];
    const noNested = () => {
      throw new Error("Nestede transaksjoner støttes ikke");
    };

    return {
      query: (text, params) => run(pool, text, params),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await fn({ query: (text, params) => run(client, text, params), tx: noNested });
          await client.query("commit");
          return result;
        } catch (err) {
          await client.query("rollback").catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL mangler");
  }

  // Lokal utvikling: Postgres i WASM, lagret i .data/pglite.
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  const db = wrapPglite(pg as unknown as PGliteLike);
  await migrate((sql) => pg.exec(sql), db);
  return db;
}

const globalForDb = globalThis as unknown as { __rebusDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__rebusDb ??= createDb().catch((err) => {
    globalForDb.__rebusDb = undefined;
    throw err;
  });
  return globalForDb.__rebusDb;
}
