"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, BookOpen, Users, FileText, TrendingUp } from "lucide-react"
import CreateChallengeDialog from "@/components/teacher/create-challenge-dialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { CreateLessonDialog } from "@/components/teacher/create-leasson-dialog"
import { CreateEvaluationDialog } from "@/components/teacher/create-evaluation-dialog"
import CreateActivityDialog from "@/components/teacher/create-activity-dialog"
import EditLessonDialog from "@/components/teacher/edit-lesson-dialog"

interface Lesson {
  id: string
  title: string
  description: string
  video_url: string | null
  pdf_url: string | null
  order_index: number
}

interface ClassDetail {
  id: string
  name: string
  description: string
  subject: string
}

export default function ClassDetailPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [evalDialogOpen, setEvalDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Extraigo la función fuera del useEffect para poder llamarla después (p. ej. desde el dialog)
  // Use useCallback so the function reference is stable and won't change between renders,
  // preventing useEffect dependency-array size warnings.
  const loadClassData = useCallback(async () => {
    setLoading(true)
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)

      if (!currentUser) {
        router.push("/auth/login")
        return
      }

      const supabase = getSupabaseClient()

      // Load class details
      const classResp = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .eq("teacher_id", currentUser.id)
        .single()
      console.debug("classResp:", classResp)
      if (classResp.error) throw classResp.error
      setClassDetail(classResp.data)

      // Load lessons
      const lessonsResp = await supabase
        .from("lessons")
        .select("*")
        .eq("class_id", classId)
        .order("order_index", { ascending: true })
      console.debug("lessonsResp:", lessonsResp)
      if (lessonsResp.error) throw lessonsResp.error
      setLessons(lessonsResp.data || [])

      // Load activities for lessons (used to list/create activities)
      const lessonIds = lessonsResp.data?.map((l: any) => l.id) || []
      let activitiesData: any[] = []
      if (lessonIds.length > 0) {
        const activitiesListResp = await supabase
          .from("activities")
          .select("id, lesson_id, title")
          .in("lesson_id", lessonIds)
        console.debug("activitiesListResp:", activitiesListResp)
        if (activitiesListResp.error) throw activitiesListResp.error
        activitiesData = activitiesListResp.data || []
        setActivities(activitiesData)
      } else {
        setActivities([])
      }

      // Load enrolled students
      const studentsResp = await supabase
        .from("class_enrollments")
        .select("student_id, users:student_id(full_name, email)")
        .eq("class_id", classId)
      console.debug("studentsResp:", studentsResp)
      if (studentsResp.error) throw studentsResp.error
      setStudents(studentsResp.data || [])

      // Load evaluations: evaluations are linked to activities -> lessons -> classes.
      // We already loaded lessons above; get activity ids for those lessons then fetch evaluations.
      const activityIds = (activitiesData.length > 0 ? activitiesData : activities).map((a: any) => a.id) || []
      if (activityIds.length > 0) {
        const evaluationsResp = await supabase.from("evaluations").select("*").in("activity_id", activityIds)
        console.debug("evaluationsResp:", evaluationsResp)
        if (evaluationsResp.error) throw evaluationsResp.error
        setEvaluations(evaluationsResp.data || [])
      } else {
        setEvaluations([])
      }

      // Load challenges for this class
      const challengesResp = await supabase
        .from("challenges")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
      console.debug("challengesResp:", challengesResp)
      if (challengesResp.error) throw challengesResp.error
      const challengesData = challengesResp.data || []
      setChallenges(challengesData)

      // Build leaderboard from challenge_responses (attempt client-side scoring for auto-gradable types)
      try {
        const challengeIds = challengesData.map((c: any) => c.id)
        if (challengeIds.length > 0) {
          const resp = await supabase.from("challenge_responses").select("*, users:student_id(full_name, email)").in("challenge_id", challengeIds)
          if (resp.error) throw resp.error
          const responses = resp.data || []

          const challengesById: Record<string, any> = {}
          challengesData.forEach((c: any) => (challengesById[c.id] = c))

          const perStudent: Record<string, { student_id: string; name?: string; email?: string; correct: number; total: number }> = {}

          responses.forEach((r: any) => {
            const sid = r.student_id
            if (!perStudent[sid]) perStudent[sid] = { student_id: sid, name: r.users?.full_name, email: r.users?.email, correct: 0, total: 0 }
            const ch = challengesById[r.challenge_id]
            if (!ch) return

            const payload = ch.payload || {}
            let correctCount = 0
            let totalCount = 1

            try {
              if (ch.type === "multiple_choice" || ch.type === "select_image") {
                const selected = r.answers?.selected
                const options = Array.isArray(payload.options) ? payload.options : []
                const correctIndex = typeof payload.correct_index === "number" ? payload.correct_index : null
                const correctOptionId = correctIndex !== null && options[correctIndex] ? options[correctIndex].id : null
                if (selected && correctOptionId && selected === correctOptionId) correctCount = 1
              } else if (ch.type === "matching") {
                const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
                const matches = Array.isArray(r.answers?.matches) ? r.answers.matches : []
                totalCount = pairs.length || 1
                let correctMatches = 0
                matches.forEach((m: any) => {
                  // support both shapes: { pairId, selectedId } or legacy { pairId, right }
                  const selectedId = m.selectedId ?? m.right
                  if (selectedId && selectedId === m.pairId) {
                    // if selectedId equals the pair id it's correct
                    correctMatches++
                  } else {
                    // otherwise, try to match by comparing selectedId to the pair.right text or id
                    const pair = pairs.find((p: any) => p.id === m.pairId)
                    if (pair && (selectedId === pair.right || selectedId === pair.id || selectedId === pair.left)) correctMatches++
                  }
                })
                correctCount = correctMatches
              } else {
                // non-auto-graded types
                correctCount = 0
                totalCount = 0
              }
            } catch (e) {
              console.warn("Error scoring response", e)
            }

            perStudent[sid].correct += correctCount
            perStudent[sid].total += totalCount
          })

          const board = Object.values(perStudent).map((s) => ({
            ...s,
            percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
          }))

          board.sort((a, b) => b.percentage - a.percentage || b.correct - a.correct)
          setLeaderboard(board)
        } else {
          setLeaderboard([])
        }
      } catch (e) {
        console.error("Error building leaderboard:", e)
        setLeaderboard([])
      }
    } catch (error) {
      // Print useful Supabase error fields when available
      try {
        console.error("Error loading class data:", error, {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code,
        })
      } catch (e) {
        console.error("Error loading class data (fallback):", error)
      }
    } finally {
      setLoading(false)
    }
  }, [classId, router])

  useEffect(() => {
    // cargar al montar y cada vez que cambie la función (la cual depende de classId)
    loadClassData()
  }, [loadClassData])

  // Llamada que pasamos al dialog para refrescar lista después de crear la lección
  const handleLessonCreated = () => {
    loadClassData()
  }

  const handleActivityCreated = () => {
    loadClassData()
  }

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("¿Eliminar esta lección? Esta acción no se puede deshacer.")) return
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const resp = await supabase.from("lessons").delete().eq("id", lessonId)
      console.debug("delete lesson resp:", resp)
      if (resp.error) throw resp.error
      setLessons((prev) => prev.filter((l) => l.id !== lessonId))
    } catch (error) {
      console.error("Error deleting lesson:", error)
      alert((error as any)?.message || "Error al eliminar la lección")
    } finally {
      setLoading(false)
    }
  }

  // Edit handled via EditLessonDialog (shadcn dialog component)

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
          Volver al Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.push("/dashboard")} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">{classDetail.name}</h1>
        <p className="text-muted-foreground mt-1">{classDetail.description}</p>
      </div>

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList>
          <TabsTrigger value="lessons">Lecciones</TabsTrigger>
          <TabsTrigger value="activities">Actividades</TabsTrigger>
          <TabsTrigger value="students">Estudiantes ({students.length})</TabsTrigger>
          <TabsTrigger value="challenges">Desafíos</TabsTrigger>
          <TabsTrigger value="glossary">Glosario</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Lecciones</h2>
            {/* Usamos el CreateLessonDialog y le pasamos classId + callback */}
            <CreateLessonDialog classId={classId} onLessonCreated={handleLessonCreated} />
          </div>

          {lessons.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Sin lecciones aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson) => (
                <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium">{lesson.title}</h3>
                      <p className="text-sm text-muted-foreground">{lesson.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <EditLessonDialog
                        lesson={lesson}
                        onLessonUpdated={(updated) => setLessons((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
                      >
                        <Button variant="ghost" size="icon">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </EditLessonDialog>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteLesson(lesson.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Actividades</h2>
            <CreateActivityDialog
              classId={classId}
              lessons={lessons.map((l) => ({ id: l.id, title: l.title }))}
              open={activityDialogOpen}
              onOpenChange={setActivityDialogOpen}
              onActivityCreated={handleActivityCreated}
            />
            <Button onClick={() => setActivityDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Nueva Actividad
            </Button>
          </div>

          {activities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">Sin actividades aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <Card key={act.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium">{act.title}</h3>
                      <p className="text-sm text-muted-foreground">Lección ID: {act.lesson_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!act?.id) {
                            console.error("Actividad sin id:", act)
                            alert("No se pudo abrir la actividad: falta el identificador (id)")
                            return
                          }
                          router.push(`/dashboard/classes/${classId}/activities/${act.id}`)
                        }}
                      >
                        Ver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <h2 className="text-xl font-semibold">Estudiantes Inscritos</h2>

          {students.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Sin estudiantes inscritos</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4">
                <ul className="space-y-2">
                  {students.map((enrollment) => (
                    <li key={enrollment.student_id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{enrollment.users?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{enrollment.users?.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="glossary" className="space-y-4">
          <Button onClick={() => router.push(`/dashboard/classes/${classId}/glossary`)}>
            <FileText className="w-4 h-4" />
            Administrar Glosario
          </Button>
          <p className="text-sm text-muted-foreground">
            Haz clic para gestionar los términos y definiciones del glosario con interpretación en Lengua de Señas
            Nicaragüense.
          </p>
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Evaluaciones</h2>
            <CreateEvaluationDialog
              classId={classId}
              open={evalDialogOpen}
              onOpenChange={setEvalDialogOpen}
              onEvaluationCreated={(newEval) => setEvaluations((prev) => [newEval, ...prev])}
            />
            <Button onClick={() => setEvalDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Nueva Evaluación
            </Button>
          </div>

          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">Sin evaluaciones aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {evaluations.map((ev) => (
                <Card key={ev.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium">{ev.title}</h3>
                      <p className="text-sm text-muted-foreground">Preguntas: {ev.questions?.length || 0}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!ev?.id) {
                            console.error("Evaluación sin id:", ev)
                            alert("No se pudo abrir la evaluación: falta el identificador (id)")
                            return
                          }
                          // navigate to activity/evaluation view if exists
                          router.push(`/dashboard/classes/${classId}/evaluations/${ev.id}`)
                        }}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("¿Eliminar esta evaluación?")) return
                          try {
                            setLoading(true)
                            const supabase = getSupabaseClient()
                            const resp = await supabase.from("evaluations").delete().eq("id", ev.id)
                            console.debug("delete evaluation resp:", resp)
                            if (resp.error) throw resp.error
                            setEvaluations((prev) => prev.filter((e) => e.id !== ev.id))
                          } catch (err) {
                            console.error("Error deleting evaluation:", err)
                            alert((err as any)?.message || "Error al eliminar evaluación")
                          } finally {
                            setLoading(false)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Desafíos</h2>
            <CreateChallengeDialog
              classId={classId}
              onChallengeCreated={(c) => setChallenges((prev) => [c, ...(prev || [])])}
            />
          </div>

          {challenges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">Sin desafíos aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {challenges.map((ch) => (
                <Card key={ch.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium">{ch.title}</h3>
                      <p className="text-sm text-muted-foreground">{ch.description}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {ch.type}</p>
                      {ch.due_at && <p className="text-xs text-muted-foreground">Vence: {new Date(ch.due_at).toLocaleString()}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          router.push(`/dashboard/classes/${classId}/challenges/${ch.id}`)
                        }}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("¿Eliminar este desafío?")) return
                          try {
                            setLoading(true)
                            const supabase = getSupabaseClient()
                            const resp = await supabase.from("challenges").delete().eq("id", ch.id)
                            console.debug("delete challenge resp:", resp)
                            if (resp.error) throw resp.error
                            setChallenges((prev) => prev.filter((x) => x.id !== ch.id))
                          } catch (err) {
                            console.error("Error deleting challenge:", err)
                            alert((err as any)?.message || "Error al eliminar desafío")
                          } finally {
                            setLoading(false)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Ranking por Desafíos</h2>
              <p className="text-sm text-muted-foreground">Los estudiantes mejor clasificados según aciertos en desafíos auto-evaluable.</p>
            </div>
            <Button onClick={() => router.push(`/dashboard/classes/${classId}/analytics`)}>
              <TrendingUp className="w-4 h-4" />
              Ver Análisis Completo
            </Button>
          </div>

          {leaderboard.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">No hay datos de retos suficientes para generar un ranking.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row, idx) => (
                <Card key={row.student_id} className="p-3">
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{idx + 1}. {row.name || row.student_id}</p>
                      <p className="text-sm text-muted-foreground">{row.email || ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{row.percentage}%</p>
                      <p className="text-xs text-muted-foreground">{row.correct} / {row.total} aciertos</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}