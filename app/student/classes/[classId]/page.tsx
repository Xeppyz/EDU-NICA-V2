"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toEmbedUrl } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, PlayCircle, FileText, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardList, Zap } from "lucide-react"

interface Lesson {
  id: string
  title: string
  description: string
  video_url: string | null
  lsn_video_url: string | null
  pdf_url: string | null
  order_index: number
}

interface ClassDetail {
  id: string
  name: string
  description: string
  subject: string
}

interface Activity {
  id: string
  lesson_id: string
  title: string
  type: "quiz" | "exercise" | "reading"
}

interface Evaluation {
  id: string
  activity_id: string
  title: string
  questions: any[]
}

export default function StudentClassPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [myResponses, setMyResponses] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadClassData() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        const supabase = getSupabaseClient()

        // Load class details
        const { data: classData } = await supabase.from("classes").select("*").eq("id", classId).single()
        setClassDetail(classData)

        // Load lessons
        const { data: lessonsData } = await supabase
          .from("lessons")
          .select("*")
          .eq("class_id", classId)
          .order("order_index", { ascending: true })
        setLessons(lessonsData || [])

        const { data: activitiesData } = await supabase
          .from("activities")
          .select("*")
          .in(
            "lesson_id",
            (lessonsData || []).map((l: any) => l.id),
          )
        setActivities(activitiesData || [])

        const { data: evaluationsData } = await supabase
          .from("evaluations")
          .select("*")
          .in(
            "activity_id",
            (activitiesData || []).map((a: any) => a.id),
          )
        setEvaluations(evaluationsData || [])

        // Fetch current student's responses for these evaluations so we can mark pending
        try {
          const currentUser = await getCurrentUser()
          if (currentUser && (evaluationsData || []).length > 0) {
            const resp = await supabase
              .from("student_responses")
              .select("id, evaluation_id, created_at")
              .eq("student_id", currentUser.id)
              .in("evaluation_id", (evaluationsData || []).map((e: any) => e.id))

            if (!resp.error) {
              const map: Record<string, any[]> = {}
                ; (resp.data || []).forEach((r: any) => {
                  map[r.evaluation_id] = map[r.evaluation_id] || []
                  map[r.evaluation_id].push(r)
                })
              setMyResponses(map)
            }
          }
        } catch (e) {
          // ignore
        }

        // Load completed lessons
        const { data: progressData } = await supabase
          .from("student_progress")
          .select("lesson_id, completed")
          .eq("student_id", currentUser.id)
          .eq("class_id", classId)
          .eq("completed", true)

        setCompletedLessons(new Set(progressData?.map((p: any) => p.lesson_id) || []))

        if (lessonsData && lessonsData.length > 0) {
          setSelectedLesson(lessonsData[0])
        }
      } catch (error) {
        console.error("Error loading class data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadClassData()
  }, [classId, router])

  const handleMarkComplete = async () => {
    if (!selectedLesson) return

    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) return

      const supabase = getSupabaseClient()

      // Update progress
      await supabase.from("student_progress").upsert({
        student_id: currentUser.id,
        class_id: classId,
        lesson_id: selectedLesson.id,
        completed: true,
        progress_percentage: 100,
      })

      setCompletedLessons(new Set([...completedLessons, selectedLesson.id]))
    } catch (error) {
      console.error("Error marking lesson complete:", error)
    }
  }

  const pendingEvaluationIds = useMemo(() => {
    const now = new Date()
    return evaluations
      .filter((evaluation: any) => {
        const start = evaluation.start_at ? new Date(evaluation.start_at) : null
        const due = evaluation.due_at ? new Date(evaluation.due_at) : null

        // not yet open
        if (start && now < start) return false

        // expired
        if (due && now > due) return false

        const attemptsAllowed = (evaluation as any).attempts_allowed ?? 1
        const attemptsUsed = (myResponses[evaluation.id] || []).length
        if (attemptsUsed >= attemptsAllowed) return false

        return true
      })
      .map((e: any) => e.id)
  }, [evaluations, myResponses])

  // DEBUG: log runtime values so we can inspect in browser console
  // Remove these logs once the issue is diagnosed
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[StudentClassPage] activities:", activities)
    // eslint-disable-next-line no-console
    console.log("[StudentClassPage] evaluations:", evaluations)
    // eslint-disable-next-line no-console
    console.log("[StudentClassPage] pendingEvaluationIds:", pendingEvaluationIds)
    // eslint-disable-next-line no-console
    console.log("[StudentClassPage] completedLessons:", Array.from(completedLessons))
  }

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
        <Button onClick={() => router.push("/student")} className="mt-4">
          Volver al Dashboard
        </Button>
      </div>
    )
  }



  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.push("/student")} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">{classDetail.name}</h1>
        <p className="text-muted-foreground mt-1">{classDetail.description}</p>
      </div>

      {/* Tabs for Lessons, Activities, and Evaluations */}
      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lessons" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Lecciones
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Actividades
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Evaluaciones
          </TabsTrigger>
        </TabsList>

        {/* Lessons Tab */}
        <TabsContent value="lessons" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lessons List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lecciones</CardTitle>
                  <CardDescription>
                    {completedLessons.size} de {lessons.length} completadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLesson(lesson)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${selectedLesson?.id === lesson.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">Lección {lesson.order_index + 1}</p>
                        </div>
                        {completedLessons.has(lesson.id) && (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Lesson Content */}
            <div className="lg:col-span-2 space-y-4">
              {selectedLesson ? (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{selectedLesson.title}</CardTitle>
                          <CardDescription className="mt-2">{selectedLesson.description}</CardDescription>
                        </div>
                        {completedLessons.has(selectedLesson.id) && <Badge className="ml-2">Completada</Badge>}
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Video Player with LSN Support */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        Video de la Lección
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedLesson.video_url ? (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          <iframe
                            width="100%"
                            height="100%"
                            src={toEmbedUrl(selectedLesson.video_url) || selectedLesson.video_url}
                            title={selectedLesson.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                          Sin video disponible
                        </div>
                      )}

                      {/* LSN Video Support */}
                      {selectedLesson.lsn_video_url && (
                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                            <PlayCircle className="w-4 h-4" />
                            Interpretación en Lengua de Señas Nicaragüense
                          </p>
                          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <iframe
                              width="100%"
                              height="100%"
                              src={toEmbedUrl(selectedLesson.lsn_video_url) || selectedLesson.lsn_video_url}
                              title={`${selectedLesson.title} - Lengua de Señas`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Materials */}
                  {selectedLesson.pdf_url && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Material de Lectura
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={selectedLesson.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Descargar PDF
                        </a>
                      </CardContent>
                    </Card>
                  )}

                  {/* Mark Complete Button */}
                  {!completedLessons.has(selectedLesson.id) && (
                    <Button onClick={handleMarkComplete} className="w-full" size="lg">
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar como Completada
                    </Button>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecciona una lección para comenzar</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Zap className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay actividades disponibles</p>
                </CardContent>
              </Card>
            ) : (
              activities.map((activity) => {
                const lesson = lessons.find((l) => l.id === activity.lesson_id)
                const activityEvaluations = evaluations.filter((e) => e.activity_id === activity.id)
                return (
                  <Card key={activity.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{activity.title}</CardTitle>
                          <CardDescription className="mt-2">Lección: {lesson?.title}</CardDescription>
                        </div>
                        <Badge variant="secondary">{activity.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {activityEvaluations.length} evaluación{activityEvaluations.length !== 1 ? "es" : ""}
                        </p>
                        {activityEvaluations.map((evaluation) => (
                          <Button
                            key={evaluation.id}
                            onClick={() => router.push(`/student/classes/${classId}/evaluations/${evaluation.id}`)}
                            variant="outline"
                            className="w-full"
                          >
                            {evaluation.title}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluations.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay evaluaciones disponibles</p>
                </CardContent>
              </Card>
            ) : (
              evaluations.map((evaluation) => {
                const activity = activities.find((a) => a.id === evaluation.activity_id)
                return (
                  <Card key={evaluation.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{evaluation.title}</CardTitle>
                      <CardDescription>Actividad: {activity?.title}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{evaluation.questions?.length || 0} preguntas</p>
                      {(() => {
                        const respForEval = myResponses[evaluation.id] || []
                        const attemptsUsedLocal = respForEval.length
                        const attemptsAllowed = (evaluation as any).attempts_allowed || 1
                        const now = new Date()
                        const start = (evaluation as any).start_at ? new Date((evaluation as any).start_at) : null
                        const due = (evaluation as any).due_at ? new Date((evaluation as any).due_at) : null
                        const notOpened = start && now < start
                        const expired = due && now > due
                        const attemptsExceeded = attemptsUsedLocal >= attemptsAllowed

                        if (notOpened) {
                          return (
                            <Button variant="outline" disabled className="w-full">
                              Abierta desde {start?.toLocaleString()}
                            </Button>
                          )
                        }

                        if (expired) {
                          return (
                            <Button variant="ghost" disabled className="w-full">
                              Plazo vencido
                            </Button>
                          )
                        }

                        if (attemptsExceeded) {
                          return (
                            <Button variant="ghost" disabled className="w-full">
                              Intentos agotados ({attemptsUsedLocal}/{attemptsAllowed})
                            </Button>
                          )
                        }

                        return (
                          <Button
                            onClick={() => router.push(`/student/classes/${classId}/evaluations/${evaluation.id}`)}
                            className="w-full"
                          >
                            Realizar Evaluación
                          </Button>
                        )
                      })()}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
