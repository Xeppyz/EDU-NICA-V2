"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function DashboardLibraryNewPage() {
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null
        setFile(f)
    }

    const determineType = (filename?: string) => {
        if (!filename) return 'link'
        const ext = filename.split('?')[0].split('.').pop()?.toLowerCase() || ''
        if (['pdf'].includes(ext)) return 'pdf'
        if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video'
        return 'link'
    }

    useEffect(() => {
        ; (async () => {
            const cu = await getCurrentUser()
            if (!cu) {
                router.push('/auth/login')
                return
            }
            if (!(cu.role === 'teacher' || cu.role === 'admin')) {
                router.push('/dashboard')
                return
            }
        })()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        try {
            const currentUser = await getCurrentUser()
            if (!currentUser) {
                router.push('/auth/login')
                return
            }

            if (!(currentUser.role === 'teacher' || currentUser.role === 'admin')) {
                setError('No tienes permisos para subir materiales.')
                return
            }

            const supabase = getSupabaseClient()

            let url: string | null = null
            let storage_path: string | null = null
            let file_type = 'link'

            if (file) {
                setUploading(true)
                const filename = `${Date.now()}-${file.name}`
                const path = `materials/${currentUser.id}/${filename}`
                const uploadResp = await supabase.storage.from('library').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
                if (uploadResp?.error) {
                    console.error('Upload response error', uploadResp.error)
                    setError(uploadResp.error.message || 'Error al subir el archivo')
                    setUploading(false)
                    return
                }
                storage_path = path
                url = null
                file_type = determineType(file.name)
            }

            const insert = await supabase.from('library_materials').insert([{ title, description, url, storage_path, file_type, uploaded_by: currentUser.id }])
            if (insert.error) throw insert.error

            // After successful insert, stay in teacher library management
            router.push('/dashboard/library')
        } catch (err: any) {
            console.error('Upload error', err)
            setError(err.message || String(err))
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-semibold mb-4">Añadir material a la Biblioteca</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Título</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Descripción</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Archivo (PDF / MP4 / WebM)</label>
                    <input type="file" accept=".pdf,video/*" onChange={handleFile} />
                </div>
                {error && <div className="text-destructive text-sm">{error}</div>}
                <div className="flex gap-2">
                    <Button type="submit" disabled={uploading}>{uploading ? 'Subiendo...' : 'Subir material'}</Button>
                    <Button variant="ghost" onClick={() => router.push('/dashboard/library')}>Cancelar</Button>
                </div>
            </form>
        </div>
    )
}
