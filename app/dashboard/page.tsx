"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, BookOpen } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import CreateClassDialog from "@/components/teacher/create-class-dialog"
import EditClassDialog from "@/components/teacher/edit-class-dialog"

interface Class {
  id: string
  name: string
  description: string
  subject: string
  created_at: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function loadClasses() {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)

        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from("classes")
          .select("*")
          .eq("teacher_id", currentUser.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setClasses(data || [])
      } catch (error: any) {
        // More detailed logging to help debug RLS / Supabase errors
        console.error("Error loading classes:", error)
        try {
          console.error("error (stringified):", JSON.stringify(error))
        } catch { }
        if (error?.message) console.error("message:", error.message)
        if (error?.status) console.error("status:", error.status)
        if (error?.details) console.error("details:", error.details)
        setErrorMessage(error?.message || "Error cargando las clases")
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [router])

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta clase?")) return

    try {
      const supabase = getSupabaseClient()

      // Ask the server to delete and return the deleted row(s) so we can confirm
      const resp = await supabase.from("classes").delete().select("*").eq("id", classId)
      // resp shape: { data, error, status }
      console.debug("delete class response:", resp)

      const { data, error } = resp

      // supabase may return an error object when RLS blocks the operation
      if (error) {
        console.error("Supabase error deleting class:", error)
        // surface a readable message to the teacher
        throw error
      }

      // If no row was actually deleted, the backend didn't remove it (RLS or not found)
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error("No rows deleted for classId:", classId, "response:", resp)
        throw new Error("No se pudo eliminar la clase (ver consola para más detalles)")
      }

      // Success: remove from local state
      setClasses(classes.filter((c) => c.id !== classId))
    } catch (error: any) {
      // Provide detailed logging to help diagnose RLS / permission issues
      console.error("Error deleting class:", error)
      try {
        console.error("error (stringified):", JSON.stringify(error))
      } catch { }
      if (error?.message) console.error("message:", error.message)
      if (error?.status) console.error("status:", error.status)
      if (error?.details) console.error("details:", error.details)
      // also show a simple feedback to the user (keeps UI from silently removing)
      setErrorMessage(error?.message || "No se pudo eliminar la clase")
    }
  }

  const handleClassCreated = (newClass: Class) => {
    setClasses([newClass, ...classes])
    setShowCreateDialog(false)
  }

  const handleClassUpdated = (updatedClass: Class) => {
    setClasses(classes.map((c) => (c.id === updatedClass.id ? updatedClass : c)))
    setEditingClass(null)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mis Clases</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus clases y materiales de enseñanza</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" />
          Nueva Clase
        </Button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Sin clases</p>
            <p className="text-muted-foreground text-sm mb-4">Comienza creando tu primera clase</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4" />
              Crear Primera Clase
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="line-clamp-2">{classItem.name}</CardTitle>
                <CardDescription>{classItem.subject}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {classItem.description || "Sin descripción"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={() => router.push(`/dashboard/classes/${classItem.id}`)}
                  >
                    Ver Detalles
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditingClass(classItem)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteClass(classItem.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateClassDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onClassCreated={handleClassCreated}
      />

      {editingClass && (
        <EditClassDialog
          classItem={editingClass}
          open={!!editingClass}
          onOpenChange={(open) => !open && setEditingClass(null)}
          onClassUpdated={handleClassUpdated}
        />
      )}
    </div>
  )
}
