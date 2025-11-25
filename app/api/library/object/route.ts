import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const path = url.searchParams.get("path")
    if (!path) {
        return NextResponse.json({ error: "Missing path" }, { status: 400 })
    }

    try {
        const supabase = await getSupabaseServerClient()
        const { data, error } = await supabase.storage.from("library").download(path)
        if (error || !data) {
            return NextResponse.json({ error: error?.message || "No se pudo descargar el archivo" }, { status: 500 })
        }
        const arrayBuffer = await data.arrayBuffer()
        const contentType = data.type || "application/octet-stream"
        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=60",
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 })
    }
}
