import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useUserId } from "./auth-provider";

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, has_access")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
