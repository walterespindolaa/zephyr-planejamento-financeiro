import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/types";

/**
 * Lista de clientes. O RLS já filtra por papel:
 * planejadora/admin veem todos; assessor vê apenas os vinculados a ele.
 */
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Client[]) ?? [];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    enabled: !!id,
    queryFn: async (): Promise<Client | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as Client) ?? null;
    },
  });
}
