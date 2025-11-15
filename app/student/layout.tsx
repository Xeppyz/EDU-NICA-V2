"use client"

import type React from "react"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { BookOpen, LogOut, GraduationCap, Trophy } from "lucide-react"
import ThemeToggle from '@/components/ui/theme-toggle'
import PendingEvaluationsCalendar from '@/components/student/pending-evaluations-calendar'

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [myResponses, setMyResponses] = useState<Record<string, any[]>>({})

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        setUser(currentUser)

        // Load enrolled classes
        const supabase = getSupabaseClient()
        const { data: enrollments } = await supabase
          .from("class_enrollments")
          .select(`
            class_id,
            classes:class_id(id, name, description)
          `)
          .eq("student_id", currentUser.id)

        setEnrolledClasses(enrollments?.map((e: any) => e.classes) || [])

        // additionally fetch activities and evaluations for those classes so the sidebar calendar can show pending items
        const classIds = enrollments?.map((e: any) => e.class_id) || []
        if (classIds.length > 0) {
          const { data: lessonsForClass } = await supabase
            .from("lessons")
            .select("id, class_id")
            .in("class_id", classIds)

          const lessonIds = (lessonsForClass || []).map((l: any) => l.id)
          if (lessonIds.length > 0) {
            const { data: activitiesData } = await supabase.from("activities").select("*").in("lesson_id", lessonIds)
            setActivities(activitiesData || [])

            const activityIds = (activitiesData || []).map((a: any) => a.id)
            if (activityIds.length > 0) {
              const { data: evaluationsData } = await supabase.from("evaluations").select("*").in("activity_id", activityIds)
              setEvaluations(evaluationsData || [])

              if (evaluationsData && evaluationsData.length > 0) {
                const resp = await supabase
                  .from("student_responses")
                  .select("id, evaluation_id, created_at")
                  .eq("student_id", currentUser.id)
                  .in("evaluation_id", evaluationsData.map((e: any) => e.id))

                if (!resp.error) {
                  const map: Record<string, any[]> = {}
                    ; (resp.data || []).forEach((r: any) => {
                      map[r.evaluation_id] = map[r.evaluation_id] || []
                      map[r.evaluation_id].push(r)
                    })
                  setMyResponses(map)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Auth error:", error)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])
  const pendingEvaluationIds = useMemo(() => {
    const now = new Date()
    return evaluations
      .filter((evaluation: any) => {
        const start = evaluation.start_at ? new Date(evaluation.start_at) : null
        const due = evaluation.due_at ? new Date(evaluation.due_at) : null

        if (start && now < start) return false
        if (due && now > due) return false

        const attemptsAllowed = (evaluation as any).attempts_allowed ?? 1
        const attemptsUsed = (myResponses[evaluation.id] || []).length
        return attemptsUsed < attemptsAllowed
      })
      .map((e: any) => e.id)
  }, [evaluations, myResponses])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    const { getAuthClient } = await import("@/lib/supabase/auth-client")
    const supabase = getAuthClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="font-semibold text-sm">Mis Lecciones</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Mis Clases</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive>
                    <a href="/student">
                      <GraduationCap className="w-4 h-4" />
                      <span>Mi Aprendizaje</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {enrolledClasses.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Clases Inscritas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {enrolledClasses.map((classItem) => (
                    <SidebarMenuItem key={classItem.id}>
                      <SidebarMenuButton asChild>
                        <a href={`/student/classes/${classItem.id}`}>
                          <BookOpen className="w-4 h-4" />
                          <span className="truncate">{classItem.name}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup>
            <SidebarGroupLabel>Ranking</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/student/ranking">
                      <Trophy className="w-4 h-4" />
                      <span>Ranking</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Recursos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/student/library">
                      <BookOpen className="w-4 h-4" />
                      <span>Biblioteca Virtual</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Compact calendar for pending evaluations */}
          <SidebarGroup>
            <SidebarGroupLabel>Próximas Evaluaciones</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2">
                <PendingEvaluationsCalendar
                  evaluations={evaluations.map((e) => ({ id: e.id, title: e.title, due_at: (e as any).due_at }))}
                  activities={activities.map((a) => ({ id: a.id, title: a.title, lesson_id: a.lesson_id }))}
                  pendingEvaluationIds={pendingEvaluationIds}
                  onSelectDate={() => { }}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Configuración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <div>
                      <ThemeToggle />
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Button onClick={handleLogout} variant="outline" className="w-full justify-start bg-transparent" size="sm">
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center justify-between p-4 border-b">
          <SidebarTrigger />
          <div className="text-sm text-muted-foreground">{user?.email}</div>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
