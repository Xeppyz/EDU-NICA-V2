"use client"

import type React from "react"

import { useState } from "react"
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
import { Plus } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"

interface CreateLessonDialogProps {
    classId: string
    onLessonCreated: () => void
}

export function CreateLessonDialog({ classId, onLessonCreated }: CreateLessonDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        videoUrl: "",
        pdfUrl: "",
    })
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [videoInputKey, setVideoInputKey] = useState(0)

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
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
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
                const objectPath = `lessons/${classId}/${Date.now()}-${safeBase}.${extension}`
                const contentType = videoFile.type || getVideoMimeType(extension)
                const uploadResp = await supabase.storage.from("library").upload(objectPath, videoFile, {
                    upsert: true,
                    contentType,
                })
                if (uploadResp.error) throw uploadResp.error
                resolvedVideoUrl = `/api/library/object?path=${encodeURIComponent(objectPath)}`
            }

            // Get the highest order index
            const { data: lastLesson } = await supabase
                .from("lessons")
                .select("order_index")
                .eq("class_id", classId)
                .order("order_index", { ascending: false })
                .limit(1)

            const nextOrder = lastLesson && lastLesson[0] ? lastLesson[0].order_index + 1 : 0

            const resp = await supabase.from("lessons").insert([
                {
                    class_id: classId,
                    title: formData.title,
                    description: formData.description,
                    video_url: resolvedVideoUrl,
                    pdf_url: formData.pdfUrl.trim() || null,
                    order_index: nextOrder,
                },
            ])

            // Log full response to make RLS / Postgres errors visible in the client console
            // Supabase responses look like: { data, error, status, statusText }
            console.debug("create lesson response:", resp)

            if (resp.error) throw resp.error

            setFormData({
                title: "",
                description: "",
                videoUrl: "",
                pdfUrl: "",
            })
            setVideoFile(null)
            setVideoInputKey((key) => key + 1)
            setOpen(false)
            onLessonCreated()
        } catch (error) {
            console.error("Error creating lesson:", error)
            alert("Error al crear la lección")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Lección
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Nueva Lección</DialogTitle>
                    <DialogDescription>Agrega una nueva lección con contenido de video, PDF o ambos.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Título *</label>
                        <Input
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            placeholder="Ej: Introducción a la Literatura"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Descripción *</label>
                        <Textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Describe el contenido de la lección"
                            rows={3}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del Video (opcional)</label>
                        <Input
                            name="videoUrl"
                            value={formData.videoUrl}
                            onChange={handleInputChange}
                            placeholder="https://ejemplo.com/video.mp4"
                            type="url"
                            disabled={!!videoFile}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Pega un enlace de YouTube/Vimeo o carga un archivo local.</p>
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
                            <p className="text-xs text-muted-foreground">Formatos recomendados: MP4, MOV o WEBM (máx. 200 MB).</p>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del PDF (opcional)</label>
                        <Input
                            name="pdfUrl"
                            value={formData.pdfUrl}
                            onChange={handleInputChange}
                            placeholder="https://ejemplo.com/documento.pdf"
                            type="url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Adjunta material complementario en PDF</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
                            {loading ? "Creando..." : "Crear Lección"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
