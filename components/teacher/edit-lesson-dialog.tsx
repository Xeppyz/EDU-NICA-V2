"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/lib/supabase/client"

interface Lesson {
    id: string
    class_id: string
    title: string
    description: string | null
    video_url: string | null
    pdf_url: string | null
    order_index: number
}

interface EditLessonDialogProps {
    lesson: Lesson
    classId: string
    children: React.ReactNode
    onLessonUpdated: (updated: Lesson) => void
}

export default function EditLessonDialog({ lesson, classId, children, onLessonUpdated }: EditLessonDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({ title: "", description: "", videoUrl: "", pdfUrl: "" })
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [videoInputKey, setVideoInputKey] = useState(0)

    useEffect(() => {
        if (lesson) {
            setFormData({
                title: lesson.title || "",
                description: lesson.description || "",
                videoUrl: lesson.video_url || "",
                pdfUrl: lesson.pdf_url || "",
            })
            setVideoFile(null)
            setVideoInputKey((key) => key + 1)
        }
    }, [lesson])

    useEffect(() => {
        if (!open) {
            setVideoFile(null)
            setVideoInputKey((key) => key + 1)
        }
    }, [open])

    const sanitizeFilename = (name: string) =>
        name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")

    const getVideoMimeType = (ext: string) => {
        switch (ext) {
            case "webm":
                return "video/webm"
            case "mov":
                return "video/quicktime"
            case "m4v":
                return "video/x-m4v"
            case "mkv":
                return "video/x-matroska"
            case "avi":
                return "video/x-msvideo"
            case "ogg":
            case "ogv":
                return "video/ogg"
            default:
                return "video/mp4"
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleVideoFileChange = (file: File | null) => {
        setVideoFile(file)
        if (file) {
            setFormData((prev) => ({ ...prev, videoUrl: "" }))
        } else {
            setVideoInputKey((key) => key + 1)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = getSupabaseClient()

            let resolvedVideoUrl = formData.videoUrl.trim() || null

            if (videoFile) {
                const extension = videoFile.name.split(".").pop()?.toLowerCase() || "mp4"
                const baseName = videoFile.name.substring(0, videoFile.name.lastIndexOf(".")) || videoFile.name
                const safeBase = sanitizeFilename(baseName) || "video"
                const storageClassId = lesson.class_id || classId
                const objectPath = `lessons/${storageClassId}/${Date.now()}-${safeBase}.${extension}`
                const contentType = videoFile.type || getVideoMimeType(extension)
                const uploadResp = await supabase.storage.from("library").upload(objectPath, videoFile, {
                    upsert: true,
                    contentType,
                })
                if (uploadResp.error) throw uploadResp.error
                resolvedVideoUrl = `/api/library/object?path=${encodeURIComponent(objectPath)}`
            }

            const resp = await supabase
                .from("lessons")
                .update({
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    video_url: resolvedVideoUrl,
                    pdf_url: formData.pdfUrl.trim() || null,
                })
                .eq("id", lesson.id)
                .select()

            console.debug("edit lesson resp:", resp)
            if (resp.error) throw resp.error

            const updated: Lesson = resp.data && resp.data[0]
                ? (resp.data[0] as Lesson)
                : {
                    ...lesson,
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    video_url: resolvedVideoUrl,
                    pdf_url: formData.pdfUrl.trim() || null,
                }
            onLessonUpdated(updated)
            setOpen(false)
            setVideoFile(null)
            setVideoInputKey((key) => key + 1)
        } catch (error) {
            console.error("Error updating lesson (dialog):", error)
            alert((error as any)?.message || "Error al actualizar la lección")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Lección</DialogTitle>
                    <DialogDescription>Actualiza título, descripción y recursos de la lección.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Título *</label>
                        <Input name="title" value={formData.title} onChange={handleInputChange} placeholder="Título de la lección" required disabled={loading} />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Descripción *</label>
                        <Textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Descripción" rows={3} required disabled={loading} />
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del Video (opcional)</label>
                        <Input
                            name="videoUrl"
                            value={formData.videoUrl}
                            onChange={handleInputChange}
                            placeholder="https://ejemplo.com/video.mp4"
                            type="url"
                            disabled={!!videoFile || loading}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Borra el enlace si prefieres subir un video nuevo.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Subir video desde tu equipo</label>
                        <Input
                            key={videoInputKey}
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleVideoFileChange(e.target.files?.[0] || null)}
                            disabled={loading || !!formData.videoUrl}
                        />
                        {videoFile ? (
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate">{videoFile.name}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleVideoFileChange(null)}>
                                    Quitar archivo
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Sube un nuevo archivo para reemplazar el video actual.</p>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del PDF (opcional)</label>
                        <Input name="pdfUrl" value={formData.pdfUrl} onChange={handleInputChange} placeholder="https://ejemplo.com/documento.pdf" type="url" disabled={loading} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
                            {loading ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
