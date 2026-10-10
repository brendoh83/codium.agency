import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Cliente anônimo, sem cookies. O fetch do Next 14 cacheia requisições POST de
// Server Components; aqui o feed precisa refletir a decisão na hora, então
// forçamos no-store em toda chamada.
export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
