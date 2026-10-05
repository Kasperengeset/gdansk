import Link from "next/link";
import { CIPHER_TYPES, isCipherType } from "@/lib/cipher";
import { getRequestDb } from "@/lib/request-db";
import { PROOF_TYPES, type PostRow } from "@/lib/game";
import { movePostAction, toggleActiveAction } from "../../actions";
import { ActionButton } from "../controls";
import { PostsMap } from "./maps";

export default async function PostsPage() {
  const db = await getRequestDb();
  const posts = await db.query<PostRow>("select * from posts order by position, id");
  let n = 0;
  const numbered = posts.map((p) => ({ post: p, number: p.active ? ++n : null }));
  const points = numbered
    .filter(({ post }) => post.lat !== null && post.lng !== null)
    .map(({ post, number }) => ({
      lat: post.lat!,
      lng: post.lng!,
      label: post.is_finale ? "Finale" : number ? String(number) : `(${post.title})`,
      active: post.active,
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Poster</h1>
        <Link href="/admin/poster/ny" className="btn btn-primary">
          Ny post
        </Link>
      </div>

      <ul className="space-y-2">
        {numbered.map(({ post, number }) => (
          <li key={post.id} className={`card flex items-center gap-3 py-3 ${post.active ? "" : "opacity-60"}`}>
            <div className="flex flex-col">
              <ActionButton action={movePostAction.bind(null, post.id, -1)} className="px-1 text-muted disabled:opacity-30">
                ▲
              </ActionButton>
              <ActionButton action={movePostAction.bind(null, post.id, 1)} className="px-1 text-muted disabled:opacity-30">
                ▼
              </ActionButton>
            </div>
            <span className="w-10 text-center font-mono text-lg font-bold">
              {post.is_finale ? "F" : (number ?? "–")}
            </span>
            <Link href={`/admin/poster/${post.id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{post.title}</p>
              <p className="truncate text-xs text-muted">
                {isCipherType(post.cipher_type) ? CIPHER_TYPES[post.cipher_type] : post.cipher_type} ·{" "}
                {PROOF_TYPES[post.proof_type]} · radius {post.radius_m} m
                {post.lat === null && <span className="font-semibold text-brand"> · mangler posisjon</span>}
              </p>
            </Link>
            <ActionButton action={toggleActiveAction.bind(null, post.id)} className="btn btn-small">
              {post.active ? "Aktiv" : "Reserve"}
            </ActionButton>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Lagene får bare de aktive postene, i denne rekkefølgen. Trykk «Aktiv»/«Reserve» for å bytte inn en reservepost.
        Endringer gjelder med en gang, også midt i løpet.
      </p>

      {points.length > 0 && <PostsMap points={points} />}
    </div>
  );
}
