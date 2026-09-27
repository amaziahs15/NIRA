import { supabase } from "@/integrations/supabase/client";

type NiraRole = "victim" | "professional" | "admin";

export async function getNiraRole(userId: string): Promise<NiraRole | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
  return (data?.role as NiraRole | undefined) ?? null;
}

export async function getNiraProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("name, language").eq("id", userId).maybeSingle();
  return data;
}

export function roleHome(role: NiraRole | null) {
  if (role === "professional") return "professional";
  if (role === "admin") return "admin";
  return "victim";
}
