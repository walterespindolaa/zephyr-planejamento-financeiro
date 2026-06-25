import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

/** Lista perfis da equipe (assessores + planejadora). Visível p/ planejadora/admin. */
export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });
}

export function useAdvisors() {
  const { data, ...rest } = useTeam();
  return {
    ...rest,
    data: (data ?? []).filter((p) => p.role === "assessor" || p.role === "admin"),
  };
}
