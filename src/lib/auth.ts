import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function adminsFromEnv() {
  return (process.env.CRM_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");
  const admins = adminsFromEnv();
  if (admins.length > 0 && !admins.includes(user.email.toLowerCase())) {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }
  return user;
}
