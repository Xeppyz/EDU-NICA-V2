"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSupabaseClient } from "@/lib/supabase/client"

interface EditClassDialogProps {
  classItem: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onClassUpdated: (updatedClass: any) => void
}

export default function EditClassDialog({ classItem, open, onOpenChange, onClassUpdated }: EditClassDialogProps) {
  const [name, setName] = useState(classItem.name)
  const [description, setDescription] = useState(classItem.description || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setName(classItem.name)
    setDescription(classItem.description || "")
  }, [classItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!name.trim()) {
        setError("El nombre de la clase es requerido")
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      const { data, error: supabaseError } = await supabase
        .from("classes")
        .update({
          name: name.trim(),
          description: description.trim(),
        })
        .eq("id", classItem.id)
        .select()

      if (supabaseError) throw supabaseError

      onClassUpdated(data[0])
      onOpenChange(false)
    } catch (error: any) {
      setError(error.message || "Error al actualizar la clase")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Clase</DialogTitle>
          <DialogDescription>Actualiza la información de tu clase</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Nombre de la Clase
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Literatura Nicaragüense"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Descripción
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el contenido de la clase..."
              rows={4}
              disabled={loading}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Actualizando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
