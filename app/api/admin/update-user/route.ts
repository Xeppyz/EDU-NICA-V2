import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { id, email, password, full_name } = body

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 })
        }

        const supabase = await getSupabaseServerClient()

        // Update auth user via admin API
        const { data, error } = await (supabase.auth as any).admin.updateUserById(id, {
            email,
            password,
            user_metadata: { full_name },
        } as any)

        if (error) {
            return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
        }

        // Update profiles table if exists
        try {
            await supabase.from('profiles').upsert({ id, full_name })
        } catch (e) {
            // ignore if table doesn't exist
        }

        return NextResponse.json({ user: data.user })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}
