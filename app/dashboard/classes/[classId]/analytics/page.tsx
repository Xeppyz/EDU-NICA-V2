"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { TrendingUp, Users, BookOpen, CheckCircle2 } from "lucide-react"

interface StudentProgress {
  id: string
  user_id: string
  full_name: string
  email: string
  overall_progress: number
  completed_lessons: number
  total_lessons: number
  average_score: number
  total_evaluations: number
}

interface ClassDetail {
  id: string
  name: string
  description: string
}

export default function AnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [students, setStudents] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    async function loadAnalytics() {
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

        // Load enrolled students
        const { data: enrollments } = await supabase
          .from("class_enrollments")
          .select("student_id")
          .eq("class_id", classId)

        console.debug("enrollments:", enrollments)

        if (!enrollments || enrollments.length === 0) {
          setStudents([])
          return
        }

        const studentIds = enrollments.map((e: any) => e.student_id)

        // Load student details
        const { data: userData, error: userError } = await supabase.from("users").select("id, full_name, email").in("id", studentIds)
        if (userError) {
          console.error("Error loading user details for analytics:", userError)
          // Likely RLS on users table; surface a friendly message and continue with minimal data
        }
        console.debug("studentIds:", studentIds, "userData:", userData)

        // Load progress data
        const { data: progressData } = await supabase
          .from("student_progress")
          .select("student_id, progress_percentage, completed, lesson_id")
          .eq("class_id", classId)

        // Load evaluations for this class (via lessons -> activities -> evaluations)
        const { data: lessonsForClass, error: lessonsError } = await supabase.from("lessons").select("id").eq("class_id", classId)
        if (lessonsError) {
          console.error("Error loading lessons for analytics:", lessonsError)
          throw lessonsError
        }
        const lessonIds = (lessonsForClass || []).map((l: any) => l.id)

        let activityIds: string[] = []
        if (lessonIds.length > 0) {
          const { data: activitiesForLessons, error: activitiesError } = await supabase.from("activities").select("id").in("lesson_id", lessonIds)
          if (activitiesError) {
            console.error("Error loading activities for analytics:", activitiesError)
            throw activitiesError
          }
          activityIds = (activitiesForLessons || []).map((a: any) => a.id)
        } else {
          console.debug("No lessons found for class, skipping activities/evaluations fetch")
        }

        let evaluationIds: string[] = []
        if (activityIds.length > 0) {
          const { data: evaluationsForActivities, error: evaluationsError } = await supabase.from("evaluations").select("id").in("activity_id", activityIds)
          if (evaluationsError) {
            console.error("Error loading evaluations for analytics:", evaluationsError)
            throw evaluationsError
          }
          evaluationIds = (evaluationsForActivities || []).map((e: any) => e.id)
        } else {
          console.debug("No activities found for class, skipping evaluations fetch")
        }

        // Load evaluation scores filtered to evaluations that belong to this class
        let responseData: any[] = []
        if (evaluationIds.length > 0) {
          const { data: respData, error: respError } = await supabase
            .from("student_responses")
            .select("student_id, score, evaluation_id")
            .in("evaluation_id", evaluationIds)
          if (respError) {
            console.error("Error loading student responses for analytics:", respError)
            throw respError
          }
          responseData = respData || []
        } else {
          console.debug("No evaluations found for class, skipping responses fetch")
        }

        console.debug({ lessonIds, activityIds, evaluationIds, responsesCount: responseData.length })

        // Calculate analytics for each student
        const studentsAnalytics =
          userData?.map((user: any) => {
            const userProgress = progressData?.filter((p: any) => p.student_id === user.id) || []
            const userResponses = responseData?.filter((r: any) => r.student_id === user.id) || []

            const completedLessons = userProgress.filter((p: any) => p.completed).length
            const totalLessons = lessonIds.length || 0
            const averageScore =
              userResponses.length > 0
                ? Math.round(userResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / userResponses.length)
                : 0

            return {
              id: user.id,
              user_id: user.id,
              full_name: user.full_name,
              email: user.email,
              overall_progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
              completed_lessons: completedLessons,
              total_lessons: totalLessons,
              average_score: averageScore,
              total_evaluations: userResponses.length,
            }
          }) || []

        setStudents(studentsAnalytics)

        // Prepare chart data
        const chartPoints = studentsAnalytics.map((s: StudentProgress) => ({
          name: s.full_name.split(" ")[0],
          progreso: s.overall_progress,
          calificacion: s.average_score,
        }))
        setChartData(chartPoints)
      } catch (error) {
        console.error("Error loading analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [classId, router])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!classDetail) {
    return (
      <div className="p-6">
        <p>No se encontró la clase</p>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const avgProgress =
    students.length > 0 ? Math.round(students.reduce((sum, s) => sum + s.overall_progress, 0) / students.length) : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">Análisis y Progreso</h1>
        <p className="text-muted-foreground mt-1">{classDetail.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estudiantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">Inscritos en la clase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProgress}%</div>
            <p className="text-xs text-muted-foreground">Promedio de la clase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluaciones</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.reduce((sum, s) => sum + s.total_evaluations, 0)}</div>
            <p className="text-xs text-muted-foreground">Completadas en total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calificación Promedio</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.length > 0
                ? Math.round(students.reduce((sum, s) => sum + s.average_score, 0) / students.length)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">En evaluaciones</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Progreso por Estudiante</CardTitle>
              <CardDescription>Porcentaje de avance en la clase</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="progreso" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calificaciones</CardTitle>
              <CardDescription>Promedio de evaluaciones por estudiante</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calificacion" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles de Estudiantes</CardTitle>
          <CardDescription>Progreso individual y calificaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground">No hay estudiantes inscritos</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Lecciones</TableHead>
                    <TableHead>Evaluaciones</TableHead>
                    <TableHead>Calificación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.overall_progress} className="w-20" />
                          <span className="text-sm font-medium">{student.overall_progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {student.completed_lessons}/{student.total_lessons}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.total_evaluations}</Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${student.average_score >= 70
                            ? "text-green-600"
                            : student.average_score >= 50
                              ? "text-yellow-600"
                              : "text-destructive"
                            }`}
                        >
                          {student.average_score}%
                        </span>
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
