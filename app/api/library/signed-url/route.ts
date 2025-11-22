import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const path = body?.path
        const expires = body?.expires ?? 60 * 60 // default 1 hour
        if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

        const supabase = await getSupabaseServerClient()
        const { data, error } = await supabase.storage.from('library').createSignedUrl(path, expires)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signedURL: data?.signedURL })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
}
