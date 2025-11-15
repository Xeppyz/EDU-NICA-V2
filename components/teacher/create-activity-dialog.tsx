"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"

interface Lesson {
  id: string
  title: string
}

interface CreateActivityDialogProps {
  classId: string
  lessons: Lesson[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onActivityCreated: () => void
}

export function CreateActivityDialog({
  classId,
  lessons,
  open,
  onOpenChange,
  onActivityCreated,
}: CreateActivityDialogProps) {
  const [title, setTitle] = useState("")
  const [type, setType] = useState<
    "quiz" | "exercise" | "reading" | "fill_blank" | "matching" | "dragdrop" | "coding"
  >("quiz")
  const [lessonId, setLessonId] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!title.trim()) {
        setError("El título de la actividad es requerido")
        setLoading(false)
        return
      }

      if (!lessonId) {
        setError("Debes seleccionar una lección")
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      const { data, error: supabaseError } = await supabase
        .from("activities")
        .insert([
          {
            lesson_id: lessonId,
            title: title.trim(),
            type,
            content: { description: description.trim() },
          },
        ])
        .select()

      if (supabaseError) throw supabaseError

      setTitle("")
      setDescription("")
      setType("quiz")
      setLessonId("")
      onOpenChange(false)
      onActivityCreated()
    } catch (error: any) {
      setError(error.message || "Error al crear la actividad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Actividad</DialogTitle>
          <DialogDescription>Crea una actividad interactiva para los estudiantes</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título de la Actividad *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cuestionario de Comprensión Lectora"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="lesson">Lección *</Label>
            <Select value={lessonId} onValueChange={setLessonId} disabled={loading}>
              <SelectTrigger id="lesson">
                <SelectValue placeholder="Selecciona una lección" />
              </SelectTrigger>
              <SelectContent>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Tipo de Actividad *</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)} disabled={loading}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quiz">Cuestionario</SelectItem>
                <SelectItem value="exercise">Ejercicio</SelectItem>
                <SelectItem value="reading">Lectura</SelectItem>
                <SelectItem value="fill_blank">Fill-in-the-Blank</SelectItem>
                <SelectItem value="matching">Matching</SelectItem>
                <SelectItem value="dragdrop">Drag & Drop</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descripción (Opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe los objetivos de la actividad..."
              rows={3}
              disabled={loading}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Actividad"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateActivityDialog
