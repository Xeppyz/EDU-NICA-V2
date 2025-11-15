import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

let supabaseServerClient: ReturnType<typeof createServerClient> | null = null

export async function getSupabaseServerClient() {
  if (!supabaseServerClient) {
    const cookieStore = await cookies()
    supabaseServerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Handle error
            }
          },
        },
      },
    )
  }
  return supabaseServerClient
}
