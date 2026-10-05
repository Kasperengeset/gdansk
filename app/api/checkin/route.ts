import { handle, json, readJson, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { checkIn, GameError } from "@/lib/game";
import { isValidPosition } from "@/lib/geo";

export async function POST(req: Request) {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    const body = await readJson(req);
    if (!isValidPosition(body)) throw new GameError("Ugyldig posisjon.");
    const { lat, lng, accuracy } = body;
    return json(await checkIn(await getDb(), teamId, { lat, lng, accuracy }));
  });
}
