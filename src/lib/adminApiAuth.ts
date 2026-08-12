import { createClient } from "@/lib/supabase/server";

function adminsFromEnv() {
  return (process.env.CRM_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminApiUser(): Promise<{ ok: true; email: string } | { ok: false; status: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, status: 401 };
  }

  const admins = adminsFromEnv();
  if (admins.length > 0 && !admins.includes(user.email.toLowerCase())) {
    return { ok: false, status: 403 };
  }

  return { ok: true, email: user.email };
}
