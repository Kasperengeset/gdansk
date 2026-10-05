import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { adminLogoutAction } from "../actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
      <nav className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3 text-sm font-semibold">
        <span className="eyebrow">Admin</span>
        <Link href="/admin">Oversikt</Link>
        <Link href="/admin/poster">Poster</Link>
        <Link href="/admin/resultat">Resultat</Link>
        <form action={adminLogoutAction} className="ml-auto">
          <button className="text-muted">Logg ut</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
