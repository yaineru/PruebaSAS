import { UserCircle } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { UpdateNameForm, ChangePasswordForm } from "@/components/profile-forms";

export const metadata = {
  title: "Mi perfil"
};

export default async function ProfilePage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabase.from("users").select("full_name, role").eq("id", tenant.userId).maybeSingle(),
    supabase.auth.getUser()
  ]);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserCircle className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Mi perfil</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {authUser.user?.email} · {profile?.role ?? tenant.role} en {tenant.companyName}
        </p>
      </section>

      <UpdateNameForm fullName={profile?.full_name ?? ""} />
      <ChangePasswordForm />
    </div>
  );
}
