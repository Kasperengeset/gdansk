import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestDb } from "@/lib/request-db";
import type { PostRow } from "@/lib/game";
import { deletePostAction, savePostAction } from "../../../actions";
import { PostForm } from "../PostForm";

/** /admin/poster/ny lager en ny post; /admin/poster/<id> redigerer. */
export default async function EditPostPage({ params }: PageProps<"/admin/poster/[id]">) {
  const { id } = await params;
  const isNew = id === "ny";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await getRequestDb();
  const posts = await db.query<PostRow>("select * from posts order by position, id");
  const existing = posts.find((p) => p.id === id);
  if (!isNew && !existing) notFound();

  const nextPosition = Math.max(0, ...posts.filter((p) => p.position < 100).map((p) => p.position)) + 1;
  const post = existing ?? {
    id: null,
    position: nextPosition,
    title: "",
    clue_text: "",
    cipher_type: "none",
    cipher_key: "",
    key_hint: "",
    task_text: "",
    lat: null,
    lng: null,
    radius_m: 75,
    proof_type: "photo" as const,
    emergency_text: "",
    emergency_penalty_min: 15,
    active: true,
    is_finale: false,
    admin_note: "",
  };

  let n = 0;
  const others = posts
    .map((p) => ({ p, number: p.active ? ++n : null }))
    .filter(({ p }) => p.id !== id && p.lat !== null && p.lng !== null)
    .map(({ p, number }) => ({
      lat: p.lat!,
      lng: p.lng!,
      label: p.is_finale ? "Finale" : number ? String(number) : p.title,
      active: p.active,
    }));

  return (
    <div className="space-y-4">
      <Link href="/admin/poster" className="text-sm text-muted">
        ← Poster
      </Link>
      <h1 className="text-2xl font-extrabold">{isNew ? "Ny post" : post.title}</h1>
      <PostForm
        post={post}
        others={others}
        save={savePostAction.bind(null, existing?.id ?? null)}
        remove={existing ? deletePostAction.bind(null, existing.id) : undefined}
      />
    </div>
  );
}
