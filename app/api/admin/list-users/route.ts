import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const role = url.searchParams.get("role")

        const supabase = await getSupabaseServerClient()

        // Use the admin API to list users
        const { data, error } = await supabase.auth.admin.listUsers()
        if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 500 })

        let users = data.users || []
        if (role) {
            users = users.filter((u: any) => (u.user_metadata?.role || "student") === role)
        }

        return NextResponse.json({ users })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}
