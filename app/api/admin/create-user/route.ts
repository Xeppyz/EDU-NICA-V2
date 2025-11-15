import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, password, role = "student", full_name } = body

        if (!email || !password) {
            return NextResponse.json({ error: "email and password are required" }, { status: 400 })
        }

        const supabase = await getSupabaseServerClient()

        // Use the admin API to create a real Supabase auth user and set user_metadata
        // NOTE: this uses the service role key and must run server-side only.
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: { role, full_name },
            email_confirm: true,
        } as any)

        if (error) {
            return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
        }

        // Optionally upsert into a `profiles` table if your project has one
        try {
            await supabase.from("profiles").upsert({ id: data.user?.id, full_name, role })
        } catch (e) {
            // ignore if profiles table doesn't exist
        }

        return NextResponse.json({ user: data.user })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}
