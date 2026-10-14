import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("profiles").select("papel").eq("id", user.id).maybeSingle();

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar email={user.email ?? ""} papel={perfil?.papel ?? null} />
      <main className="min-h-screen pt-14 md:pl-64 md:pt-0">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
