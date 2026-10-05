import { handle, json, readJson, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { GameError, recordPosition } from "@/lib/game";
import { isValidPosition } from "@/lib/geo";

/** Siste kjente posisjon, kun synlig for admin. `test: true` markerer at GPS-testen i lobbyen virket. */
export async function POST(req: Request) {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    const body = await readJson(req);
    const gpsTest = body.test === true;
    if (!isValidPosition(body)) throw new GameError("Ugyldig posisjon.");
    const { lat, lng, accuracy } = body;
    await recordPosition(await getDb(), teamId, { lat, lng, accuracy }, gpsTest);
    return json({ ok: true });
  });
}
