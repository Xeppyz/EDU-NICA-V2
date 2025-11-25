"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users } from "lucide-react"
import JoinClassDialog from "@/components/student/join-class-dialog"
import { getChallengeTypeLabel } from "@/lib/challenges"


interface EnrolledClass {
  id: string
  name: string
  description: string
  subject: string
  progress_percentage?: number
}

export default function StudentDashboard() {
  const router = useRouter()
  const [classes, setClasses] = useState<EnrolledClass[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
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

        // Get enrolled classes with progress
        const { data: enrollments } = await supabase
          .from("class_enrollments")
          .select(`
            class_id,
            classes:class_id(id, name, description, subject)
          `)
          .eq("student_id", currentUser.id)

        if (enrollments) {

          const classIds = enrollments.map((e: { class_id: string }) => e.class_id)

          // Load lessons for these classes to compute totals per class
          const { data: lessonsForClass } = await supabase
            .from("lessons")
            .select("id, class_id")
            .in("class_id", classIds)

          const lessonsCountMap: Record<string, number> = {}
            ; (lessonsForClass || []).forEach((l: any) => {
              lessonsCountMap[l.class_id] = (lessonsCountMap[l.class_id] || 0) + 1
            })

          // Get student progress rows for these classes
          const { data: progressData } = await supabase
            .from("student_progress")
            .select("class_id, lesson_id, progress_percentage, completed")
            .eq("student_id", currentUser.id)
            .in("class_id", classIds)

          // Map completed lessons per class
          const completedCountMap: Record<string, number> = {}
            ; (progressData || []).forEach((p: any) => {
              if (p.completed) {
                completedCountMap[p.class_id] = (completedCountMap[p.class_id] || 0) + 1
              }
            })

          const classesWithProgress = enrollments.map((e: { class_id: string; classes: { id: string; name: string; description: string; subject: string } }) => {
            const totalLessons = lessonsCountMap[e.class_id] || 0
            const completed = completedCountMap[e.class_id] || 0
            const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0
            return {
              ...e.classes,
              progress_percentage: percent,
            }
          })

          setClasses(classesWithProgress)

          // Load active challenges for these classes (client-side filter for start/due)
          try {
            const { data: challengesData, error: challengesError } = await supabase
              .from("challenges")
              .select("id, title, type, start_at, due_at, class_id, classes:class_id(id, name)")
              .in("class_id", classIds)

            if (challengesError) {
              console.warn("Error loading challenges:", challengesError)
            } else {
              const now = new Date()
              const active = (challengesData || []).filter((ch: any) => {
                const startOk = !ch.start_at || new Date(ch.start_at) <= now
                const dueOk = !ch.due_at || new Date(ch.due_at) >= now
                return startOk && dueOk
              })
              setChallenges(active)
            }
          } catch (e) {
            console.warn("Could not load challenges:", e)
          }
        }
      } catch (error) {
        console.error("Error loading classes:", error)
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [router])



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
          <h1 className="text-3xl font-bold">Mi Aprendizaje</h1>
          <p className="text-muted-foreground mt-1">Accede a tus clases y continúa tu aprendizaje</p>
        </div>
        <Button onClick={() => setShowJoinDialog(true)}>
          <Users className="w-4 h-4" />
          Unirse a Clase
        </Button>
      </div>

      {/* Active challenges section */}
      <div>
        <h2 className="text-xl font-semibold">Desafíos activos</h2>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay desafíos activos por ahora.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((ch) => (
              <Card key={ch.id} className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/student/classes/${ch.class_id}/challenges/${ch.id}`)}>
                <CardHeader>
                  <CardTitle className="line-clamp-2">{ch.title}</CardTitle>
                  <CardDescription>{ch.classes?.name || "Clase"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Tipo: {getChallengeTypeLabel(ch.type)}</p>
                  {ch.due_at && <p className="text-sm text-destructive">Vence: {new Date(ch.due_at).toLocaleString()}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>



      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Sin clases inscritas</p>
            <p className="text-muted-foreground text-sm mb-4">Únete a una clase para empezar a aprender</p>
            <Button onClick={() => setShowJoinDialog(true)}>Unirse a Clase</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((classItem) => (
            <Card
              key={classItem.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/student/classes/${classItem.id}`)}
            >
              <CardHeader>
                <CardTitle className="line-clamp-2">{classItem.name}</CardTitle>
                <CardDescription>{classItem.subject}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {classItem.description || "Sin descripción"}
                </p>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className="font-semibold">{classItem.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${classItem.progress_percentage}%` }}
                    />
                  </div>
                </div>
                <Button variant="outline" className="w-full bg-transparent" size="sm">
                  Continuar Aprendiendo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JoinClassDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        onClassJoined={(newClass) => {
          setClasses([...classes, { ...newClass, progress_percentage: 0 }])
          setShowJoinDialog(false)
        }}
      />
    </div>
  )
}
