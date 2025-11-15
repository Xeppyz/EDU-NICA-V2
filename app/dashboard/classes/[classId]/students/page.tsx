"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, User, Trash2 } from "lucide-react"

interface StudentEnrollment {
  id: string
  student_id: string
  full_name: string
  email: string
  enrolled_at: string
  progress_percentage: number
  completed_lessons: number
}

export default function StudentManagementPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [students, setStudents] = useState<StudentEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [classDetail, setClassDetail] = useState<any>(null)

  useEffect(() => {
    async function loadStudents() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        const supabase = getSupabaseClient()

        // Load class
        const { data: classData } = await supabase
          .from("classes")
          .select("*")
          .eq("id", classId)
          .eq("teacher_id", currentUser.id)
          .single()

        setClassDetail(classData)

        // Load enrollments
        const { data: enrollmentData } = await supabase
          .from("class_enrollments")
          .select(`
            id,
            student_id,
            enrolled_at,
            users:student_id(id, full_name, email)
          `)
          .eq("class_id", classId)
          .order("enrolled_at", { ascending: false })

        if (enrollmentData) {
          // Get progress for each student
          const studentIds = enrollmentData.map((e) => e.student_id)
          const { data: progressData } = await supabase
            .from("student_progress")
            .select("student_id, progress_percentage, completed")
            .eq("class_id", classId)
            .in("student_id", studentIds)

          const progressMap = {}
          progressData?.forEach((p) => {
            if (!progressMap[p.student_id]) {
              progressMap[p.student_id] = { progress: 0, completed: 0 }
            }
            progressMap[p.student_id].progress += p.progress_percentage || 0
            if (p.completed) progressMap[p.student_id].completed += 1
          })

          const studentsWithProgress = enrollmentData.map((e) => ({
            id: e.id,
            student_id: e.student_id,
            full_name: e.users?.full_name || "Sin nombre",
            email: e.users?.email || "Sin correo",
            enrolled_at: e.enrolled_at,
            progress_percentage: progressMap[e.student_id]?.progress || 0,
            completed_lessons: progressMap[e.student_id]?.completed || 0,
          }))

          setStudents(studentsWithProgress)
        }
      } catch (error) {
        console.error("Error loading students:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStudents()
  }, [classId, router])

  const handleRemoveStudent = async (enrollmentId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas remover este estudiante?")) return

    try {
      const supabase = getSupabaseClient()
      await supabase.from("class_enrollments").delete().eq("id", enrollmentId)
      setStudents(students.filter((s) => s.id !== enrollmentId))
    } catch (error) {
      console.error("Error removing student:", error)
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">Gestión de Estudiantes</h1>
        <p className="text-muted-foreground mt-1">{classDetail?.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estudiantes Inscritos</CardTitle>
          <CardDescription>
            {students.length} estudiante{students.length !== 1 ? "s" : ""} inscrito{students.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay estudiantes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Inscrito</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Lecciones</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-sm">
                        <a href={`mailto:${student.email}`} className="text-primary hover:underline">
                          {student.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(student.enrolled_at).toLocaleDateString("es-ES")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {student.progress_percentage > 0
                            ? Math.round(student.progress_percentage / (student.completed_lessons || 1))
                            : 0}
                          %
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{student.completed_lessons}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveStudent(student.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
