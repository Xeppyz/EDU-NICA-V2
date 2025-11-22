"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, BookOpen, Play, Trash2 } from "lucide-react"
import VideoModal from "@/components/student/video-modal"

interface Material {
    id: string
    title: string
    description?: string
    url?: string
    storage_path?: string
    file_type?: string
    display_url?: string
}

function isYouTube(url?: string) {
    if (!url) return false
    try {
        const u = new URL(url)
        return u.hostname.includes('youtube.com') || u.hostname === 'youtu.be'
    } catch (e) {
        return false
    }
}

function isVideo(url?: string) {
    if (!url) return false
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
    return ['mp4', 'webm', 'ogg'].includes(ext) || isYouTube(url)
}

function isPdf(url?: string) {
    if (!url) return false
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
    return ext === 'pdf'
}

export default function DashboardLibraryPage() {
    const router = useRouter()
    const [materials, setMaterials] = useState<Material[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const cu = await getCurrentUser()
                if (!cu) {
                    router.push('/auth/login')
                    return
                }
                if (cu.role !== 'teacher' && cu.role !== 'admin') {
                    router.push('/student')
                    return
                }
                setUser(cu)

                const supabase = getSupabaseClient()
                const { data, error } = await supabase.from('library_materials').select('id, title, description, url, storage_path, file_type, uploaded_by').order('created_at', { ascending: false })
                let mats: any[] = []
                if (!error && data) mats = data

                const withUrls = await Promise.all((mats || []).map(async (m: any) => {
                    if (m.storage_path) {
                        // try client-signed URL (accept different response shapes)
                        try {
                            const { data: signed, error: sErr } = await supabase.storage.from('library').createSignedUrl(m.storage_path, 60 * 60)
                            const clientSigned = signed?.signedURL || signed?.signedUrl || signed?.signed_url
                            if (!sErr && clientSigned) return { ...m, display_url: clientSigned }
                        } catch (e) { }
                        try {
                            const r = await fetch('/api/library/signed-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: m.storage_path, expires: 60 * 60 }) })
                            const jr = await r.json()
                            const serverSigned = jr?.signedURL || jr?.signedUrl || jr?.signed_url || jr?.data?.signedUrl
                            if (serverSigned) return { ...m, display_url: serverSigned }
                        } catch (e) { }
                    }
                    return { ...m, display_url: m.url }
                }))

                setMaterials(withUrls)
            } catch (e) {
                console.error('Error loading library for dashboard', e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [router])

    const handleDelete = async (m: Material) => {
        if (!confirm('¿Eliminar este material? Esta acción eliminará el registro y el archivo del storage.')) return
        try {
            const supabase = getSupabaseClient()
            if (m.storage_path) {
                await supabase.storage.from('library').remove([m.storage_path])
            }
            const resp = await supabase.from('library_materials').delete().eq('id', m.id)
            if (resp.error) throw resp.error
            setMaterials((prev) => prev.filter((x) => x.id !== m.id))
        } catch (e) {
            console.error('Error deleting material', e)
            alert('No se pudo eliminar el material')
        }
    }

    if (loading) return <div className="p-6"><p className="text-sm text-muted-foreground">Cargando biblioteca...</p></div>

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6" /> Biblioteca (Docentes)</h1>
                    <p className="text-muted-foreground">Administra materiales disponibles para los estudiantes.</p>
                </div>
                <div>
                    <Button variant="outline" onClick={() => router.push('/dashboard/library/new')}>Añadir material</Button>
                </div>
            </div>

            {materials.length === 0 ? (
                <Card>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No hay materiales aún.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {materials.map((m) => (
                        <Card key={m.id} className="hover:shadow-md transition-shadow">
                            <div className="p-4">
                                <h3 className="font-semibold">{m.title}</h3>
                                <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                                <div className="flex items-center gap-2">
                                    {isVideo(m.display_url || m.url) ? (
                                        <>
                                            <VideoModal url={m.display_url || m.url || ''} title={m.title} trigger={<Button size="sm">Ver video</Button>} />
                                            <a href={m.display_url || m.url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">Abrir</Button></a>
                                        </>
                                    ) : isPdf(m.display_url || m.url) ? (
                                        <>
                                            <a href={m.display_url || m.url} target="_blank" rel="noreferrer"><Button size="sm">Abrir PDF</Button></a>
                                        </>
                                    ) : m.url ? (
                                        <a href={m.display_url || m.url} target="_blank" rel="noreferrer"><Button size="sm">Abrir recurso</Button></a>
                                    ) : (
                                        <Button variant="ghost" size="sm" disabled>Sin enlace</Button>
                                    )}

                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(m)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
