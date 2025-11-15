"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { AlertCircle } from "lucide-react"

interface JoinClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClassJoined: (newClass: any) => void
}

export default function JoinClassDialog({ open, onOpenChange, onClassJoined }: JoinClassDialogProps) {
  const [classCode, setClassCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const user = await getCurrentUser()
      if (!user) throw new Error("No autenticado")

      const supabase = getSupabaseClient()

      // Try to find class by ID first (allow pasting ID), then by join_code
      let classData: any = null
      const trimmed = classCode.trim()

      // Try by id
      const { data: byId } = await supabase.from("classes").select("*").eq("id", trimmed).single()
      if (byId) {
        classData = byId
      } else {
        // Try by join_code
        const { data: byCode } = await supabase.from("classes").select("*").eq("join_code", trimmed).single()
        if (byCode) {
          classData = byCode
        }
      }

      if (!classData) {
        setError("No se encontró la clase con ese código")
        setLoading(false)
        return
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from("class_enrollments")
        .select("id")
        .eq("student_id", user.id)
        .eq("class_id", classData.id)
        .single()

      if (existingEnrollment) {
        setError("Ya estás inscrito en esta clase")
        setLoading(false)
        return
      }

      // Enroll student
      const { error: enrollError } = await supabase.from("class_enrollments").insert([
        {
          student_id: user.id,
          class_id: classData.id,
        },
      ])

      if (enrollError) throw enrollError

      // Initialize progress tracking
      await supabase.from("student_progress").insert([
        {
          student_id: user.id,
          class_id: classData.id,
          progress_percentage: 0,
        },
      ])

      onClassJoined(classData)
      setClassCode("")
    } catch (error: any) {
      setError(error.message || "Error al unirse a la clase")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unirse a Clase</DialogTitle>
          <DialogDescription>Ingresa el código de la clase proporcionado por tu docente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="classCode" className="block text-sm font-medium mb-1">
              Código de Clase
            </label>
            <Input
              id="classCode"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="Ingresa el código de la clase"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">Pídele el código a tu docente</p>
          </div>

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Uniéndose..." : "Unirse"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
