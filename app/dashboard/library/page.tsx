"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BookOpen, Trash2, Pencil } from "lucide-react"
import VideoModal from "@/components/student/video-modal"

interface Material {
    id: string
    title: string
    description?: string
    url?: string
    storage_path?: string
    file_type?: string
    display_url?: string
    uploaded_by?: string | null
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
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [editDescription, setEditDescription] = useState("")
    const [savingEdit, setSavingEdit] = useState(false)
    const [editError, setEditError] = useState<string | null>(null)

    const canManageMaterial = (material: Material) => {
        if (!user) return false
        if (user.role === 'admin' || user.role === 'teacher') return true
        return material.uploaded_by === user.id
    }

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
        if (!canManageMaterial(m)) {
            alert('No tienes permisos para eliminar este material')
            return
        }
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

    const openEditDialog = (material: Material) => {
        if (!canManageMaterial(material)) {
            alert('No tienes permisos para editar este material')
            return
        }
        setEditingMaterial(material)
        setEditTitle(material.title)
        setEditDescription(material.description || "")
        setEditError(null)
    }

    const closeEditDialog = () => {
        if (savingEdit) return
        setEditingMaterial(null)
        setEditTitle("")
        setEditDescription("")
        setEditError(null)
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingMaterial) return

        // Validación básica de UI
        if (!canManageMaterial(editingMaterial)) {
            setEditError('No tienes permisos para editar este material')
            return
        }

        setSavingEdit(true)
        setEditError(null)

        try {
            const supabase = getSupabaseClient()
            const trimmedTitle = editTitle.trim()

            if (!trimmedTitle) {
                throw new Error('El título es obligatorio')
            }

            const trimmedDescription = editDescription.trim()

            // ACTUALIZACIÓN OPTIMIZADA
            // Usamos .select() al final para obtener el registro actualizado en una sola llamada.
            const { data, error } = await supabase
                .from('library_materials')
                .update({
                    title: trimmedTitle,
                    description: trimmedDescription || null
                })
                .eq('id', editingMaterial.id)
                .select() // Esto devuelve el registro actualizado
                .single()

            if (error) throw error

            // Si data es null, significa que RLS bloqueó la actualización (silenciosamente)
            if (!data) throw new Error("No tienes permiso para editar este registro.")

            // Actualizar el estado local con los nuevos datos reales
            setMaterials((prev) =>
                prev.map((mat) =>
                    mat.id === editingMaterial.id
                        ? { ...mat, title: data.title, description: data.description || undefined }
                        : mat,
                ),
            )

            closeEditDialog()
        } catch (err: any) {
            console.error('Error updating material', err)
            setEditError(err?.message || 'No se pudo actualizar el material')
        } finally {
            setSavingEdit(false)
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

                                    {canManageMaterial(m) && (
                                        <>
                                            <Button variant="secondary" size="sm" onClick={() => openEditDialog(m)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(m)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!editingMaterial} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar material</DialogTitle>
                        <DialogDescription>Actualiza el título o la descripción del recurso.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Título</label>
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={savingEdit} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Descripción</label>
                            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} disabled={savingEdit} />
                        </div>
                        {editError && <p className="text-sm text-destructive">{editError}</p>}
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={closeEditDialog} disabled={savingEdit}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={savingEdit}>
                                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
