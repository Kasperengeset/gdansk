import { connection } from "next/server";
import { getDb, type Db } from "./db";

/**
 * Databasen for sider (server components). `connection()` gjør at Next venter på en ekte
 * forespørsel, så spørringene aldri kjøres under `next build` – der blir de hengende.
 */
export async function getRequestDb(): Promise<Db> {
  await connection();
  return getDb();
}
