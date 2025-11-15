"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/lib/supabase/auth-client"

interface CreateClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClassCreated: (newClass: any) => void
}

export default function CreateClassDialog({ open, onOpenChange, onClassCreated }: CreateClassDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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

      const user = await getCurrentUser()
      if (!user) throw new Error("No autenticado")

      const supabase = getSupabaseClient()
      // Generate a short join code (6 uppercase alphanumeric)
      const generateCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // avoid confusing characters
        let out = ""
        for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
        return out
      }
      const join_code = generateCode()
      const { data, error: supabaseError } = await supabase
        .from("classes")
        .insert([
          {
            teacher_id: user.id,
            name: name.trim(),
            description: description.trim(),
            subject: "Lengua y Literatura",
            join_code,
          },
        ])
        .select()

      if (supabaseError) throw supabaseError

      const newClass = data[0]
      onClassCreated(newClass)
      setName("")
      setDescription("")
      onOpenChange(false)
    } catch (error: any) {
      setError(error.message || "Error al crear la clase")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Clase</DialogTitle>
          <DialogDescription>Crea una nueva clase de Lengua y Literatura</DialogDescription>
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
              {loading ? "Creando..." : "Crear Clase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
