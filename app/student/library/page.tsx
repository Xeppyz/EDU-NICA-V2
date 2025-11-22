"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, FileText, Video, Link as LinkIcon, ExternalLink } from "lucide-react"
import VideoModal from "@/components/student/video-modal"

interface Material {
    id: string
    title: string
    description?: string
    url?: string
    storage_path?: string
    file_type?: string
    display_url?: string
    created_at: string
}

function isYouTube(url?: string) {
    if (!url) return false
    try {
        const u = new URL(url)
        return u.hostname.includes('youtube.com') || u.hostname === 'youtu.be'
    } catch (e) { return false }
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

export default function StudentLibraryPage() {
    const router = useRouter()
    const [materials, setMaterials] = useState<Material[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<string>('all')
    const [query, setQuery] = useState<string>('')
    const [visibleCount, setVisibleCount] = useState<number>(9)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const cu = await getCurrentUser()
                if (!cu) {
                    router.push('/auth/login')
                    return
                }

                const supabase = getSupabaseClient()

                const { data, error } = await supabase
                    .from('library_materials')
                    .select('id, title, description, url, storage_path, file_type, created_at')
                    .order('created_at', { ascending: false })

                let mats: any[] = []
                if (!error && data) mats = data

                const withUrls = await Promise.all((mats || []).map(async (m: any) => {
                    if (m.storage_path) {
                        try {
                            const { data: signed } = await supabase.storage.from('library').createSignedUrl(m.storage_path, 60 * 60)
                            const clientSigned = signed?.signedURL || signed?.signedUrl || signed?.signed_url || signed?.signedurl
                            if (clientSigned) return { ...m, display_url: clientSigned }
                        } catch (e) { }

                        try {
                            const r = await fetch('/api/library/signed-url', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: m.storage_path })
                            })
                            const jr = await r.json()
                            const serverSigned = jr?.signedURL || jr?.signedUrl || jr?.signed_url || jr?.data?.signedUrl || jr?.signedurl
                            if (serverSigned) return { ...m, display_url: serverSigned }
                        } catch (e) { }
                    }
                    return { ...m, display_url: m.url }
                }))

                setMaterials(withUrls)
            } catch (e) {
                console.error('Error cargando biblioteca', e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [router])

    const filtered = materials.filter((m) => {
        const q = query.trim().toLowerCase()
        const url = (m.display_url || m.url || '').toLowerCase()
        const title = (m.title || '').toLowerCase()
        const desc = (m.description || '').toLowerCase()

        if (activeTab === 'pdf' && !isPdf(url)) return false
        if (activeTab === 'video' && !isVideo(url)) return false
        if (activeTab === 'links' && isVideo(url) && !isPdf(url)) return false

        if (!q) return true
        return title.includes(q) || desc.includes(q)
    })

    const visible = filtered.slice(0, visibleCount)

    const getIcon = (m: Material) => {
        const url = m.display_url || m.url || ''
        if (isVideo(url)) return <Video className="w-10 h-10 text-blue-500 mb-2" />
        if (isPdf(url)) return <FileText className="w-10 h-10 text-red-500 mb-2" />
        return <LinkIcon className="w-10 h-10 text-green-500 mb-2" />
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando recursos...</div>

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-primary" />
                    Biblioteca de Recursos
                </h1>
                <p className="text-muted-foreground text-lg">Accede a los materiales de estudio, videos y documentos compartidos por tus profesores.</p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Tabs defaultValue="all" onValueChange={(v) => setActiveTab(v)}>
                        <TabsList>
                            <TabsTrigger value="all">Todos</TabsTrigger>
                            <TabsTrigger value="pdf">PDFs</TabsTrigger>
                            <TabsTrigger value="video">Videos</TabsTrigger>
                            <TabsTrigger value="links">Enlaces</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="w-full md:w-80">
                    <Input placeholder="Buscar por título o descripción..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
            </div>

            {materials.length === 0 ? (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No hay materiales publicados todavía.</p>
                    </CardContent>
                </Card>
            ) : (
                <div>
                    {filtered.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">No se encontraron resultados para tu búsqueda/selección.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {visible.map((m) => (
                                <Card key={m.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary">
                                    <div className="p-5 flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">{getIcon(m)}</div>
                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{new Date(m.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">{m.title}</h3>

                                        {m.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">{m.description}</p>}

                                        <div className="mt-auto pt-4 border-t">
                                            {isVideo(m.display_url || m.url) ? (
                                                <div className="flex gap-2">
                                                    <VideoModal url={m.display_url || m.url || ''} title={m.title} trigger={<Button className="w-full">Ver Video</Button>} />
                                                </div>
                                            ) : (
                                                <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground" variant="outline">
                                                    <a href={m.display_url || m.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                                                        {isPdf(m.display_url || m.url) ? 'Leer Documento' : 'Abrir Enlace'}
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {visible.length < filtered.length && (
                        <div className="flex justify-center mt-4">
                            <Button variant="ghost" onClick={() => setVisibleCount((v) => v + 9)}>Cargar más</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
