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
    title: string
    description: string
    video_url: string | null
    pdf_url: string | null
    order_index: number
}

interface EditLessonDialogProps {
    lesson: Lesson
    children: React.ReactNode
    onLessonUpdated: (updated: Lesson) => void
}

export default function EditLessonDialog({ lesson, children, onLessonUpdated }: EditLessonDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({ title: "", description: "", videoUrl: "", pdfUrl: "" })

    useEffect(() => {
        if (lesson) {
            setFormData({
                title: lesson.title || "",
                description: lesson.description || "",
                videoUrl: lesson.video_url || "",
                pdfUrl: lesson.pdf_url || "",
            })
        }
    }, [lesson])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const supabase = getSupabaseClient()
            const resp = await supabase
                .from("lessons")
                .update({
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    video_url: formData.videoUrl || null,
                    pdf_url: formData.pdfUrl || null,
                })
                .eq("id", lesson.id)
                .select()

            console.debug("edit lesson resp:", resp)
            if (resp.error) throw resp.error

            const updated = resp.data && resp.data[0] ? resp.data[0] : { ...lesson, title: formData.title, description: formData.description }
            onLessonUpdated(updated)
            setOpen(false)
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
                        <Input name="title" value={formData.title} onChange={handleInputChange} placeholder="Título de la lección" required />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Descripción *</label>
                        <Textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Descripción" rows={3} required />
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del Video (opcional)</label>
                        <Input name="videoUrl" value={formData.videoUrl} onChange={handleInputChange} placeholder="https://..." type="url" />
                    </div>

                    <div>
                        <label className="text-sm font-medium">URL del PDF (opcional)</label>
                        <Input name="pdfUrl" value={formData.pdfUrl} onChange={handleInputChange} placeholder="https://..." type="url" />
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
