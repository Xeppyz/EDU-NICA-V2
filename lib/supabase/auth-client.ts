import { createBrowserClient } from "@supabase/ssr"
import { demoUsers, type DemoUser } from "@/lib/demo-users"

let authClient: ReturnType<typeof createBrowserClient> | null = null
let currentDemoUser: (DemoUser & { authenticated: true }) | null = null

// Demo mode flag
// Set to `false` to use the real Supabase client instead of demo users
const DEMO_MODE = false

export function getAuthClient() {
  if (!authClient && !DEMO_MODE) {
    authClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    )
  }
  return authClient
}

export async function signUp(email: string, password: string, fullName: string, role: "teacher" | "student"): Promise<{ data: any | null; error: Error | null }> {
  if (DEMO_MODE) {
    // In demo mode, create a virtual user
    const newUser: DemoUser = {
      id: `${role}-${Date.now()}`,
      email,
      password,
      fullName,
      role,
    }
    currentDemoUser = { ...newUser, authenticated: true }
    // Store in localStorage to persist across page reloads
    localStorage.setItem("demo_user", JSON.stringify(currentDemoUser))
    return { data: { user: newUser }, error: null }
  }

  const supabase = getAuthClient()
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
      },
    })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return { data: null, error }
  }
}

export async function signIn(email: string, password: string): Promise<{ data: any | null; error: Error | null }> {
  if (DEMO_MODE) {
    // Check if user exists in demo users
    const user = demoUsers.find((u) => u.email === email && u.password === password)
    if (!user) {
      return {
        data: null,
        error: new Error("Credenciales inválidas. Usa las credenciales de demostración."),
      }
    }
    currentDemoUser = { ...user, authenticated: true }
    // Store in localStorage to persist across page reloads
    localStorage.setItem("demo_user", JSON.stringify(currentDemoUser))
    return { data: { user }, error: null }
  }

  const supabase = getAuthClient()
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return { data: null, error }
  }
}

export async function signOut() {
  if (DEMO_MODE) {
    currentDemoUser = null
    localStorage.removeItem("demo_user")
    return { error: null }
  }

  const supabase = getAuthClient()
  return supabase.auth.signOut()
}

export async function getCurrentUser() {
  if (DEMO_MODE) {
    // Check localStorage first
    const stored = localStorage.getItem("demo_user")
    if (stored) {
      currentDemoUser = JSON.parse(stored)
      return currentDemoUser
    }
    return null
  }

  const supabase = getAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { ...user, role: user.user_metadata?.role || "student" } : null
}

export async function getUserRole() {
  const user = await getCurrentUser()
  return user?.role || "student"
}
