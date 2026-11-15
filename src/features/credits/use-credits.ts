import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

export type CreditCosts = Record<string, number>;

// Kept free of zod: this hook is part of the first load.
function parseCreditCosts(value: unknown): CreditCosts {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] =>
      Number.isInteger(entry[1]) && (entry[1] as number) > 0
    ),
  );
}

export function useBalance() {
  return useQuery({
    queryKey: queryKeys.balance,
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_balances").select("available, reserved").single();
      if (error) throw error;
      return { available: Number(data.available ?? 0), reserved: Number(data.reserved ?? 0) };
    },
  });
}

/** Price list from settings: the single source for what the UI shows and what the server reserves. */
export function useCreditCosts() {
  return useQuery({
    queryKey: queryKeys.creditCosts,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "credit_costs")
        .maybeSingle();
      if (error) throw error;
      return parseCreditCosts(data?.value);
    },
  });
}

export interface CreditCheck {
  loading: boolean;
  /** Undefined when the kind has no price: the action is not available. */
  cost: number | undefined;
  available: number;
  affordable: boolean;
}

export function useCreditCheck(kind: string): CreditCheck {
  const costs = useCreditCosts();
  const balance = useBalance();
  const cost = costs.data?.[kind];
  const available = balance.data?.available ?? 0;
  return {
    loading: costs.isPending || balance.isPending,
    cost,
    available,
    affordable: cost !== undefined && available >= cost,
  };
}
