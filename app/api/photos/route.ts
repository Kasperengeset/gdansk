import { handle, json, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { addPhoto, GameError } from "@/lib/game";

// Bildene komprimeres i nettleseren (~1600 px JPEG), så dette er god margin.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File)) throw new GameError("Mangler bilde.");
    if (!file.type.startsWith("image/")) throw new GameError("Filen er ikke et bilde.");
    if (file.size > MAX_BYTES) throw new GameError("Bildet er for stort.");
    const id = await addPhoto(await getDb(), teamId, file.type, new Uint8Array(await file.arrayBuffer()));
    return json({ id });
  });
}
