import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface UserRow { id: string; role: string | null }
interface ClassRow { id: string; teacher_id: string | null; name: string | null }
interface EnrollmentRow { class_id: string | null; student_id: string | null; teacher_id: string | null }
interface ProgressRow { class_id: string | null; progress_percentage: number | null; student_id: string | null }
interface ResponseRow { student_id: string | null; score: number | null; evaluation_id: string | null }

export async function GET() {
    try {
        // Intentar usar service role para evitar RLS en métricas agregadas.
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabase = (url && serviceKey)
            ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
            : await getSupabaseServerClient()

        // Usuarios y roles
        let usersError: string | null = null
        const { data: usersRows, error: usersErr } = await supabase.from('users').select('id,role')
        if (usersErr) usersError = usersErr.message
        const users: UserRow[] = (usersRows || []) as UserRow[]
        const distinctRoles = Array.from(new Set(users.map((u: UserRow) => String(u.role))))

        const roleNorm = (r: any) => String(r || '').toLowerCase().trim()
        const studentRoleSet = new Set(['student', 'estudiante'])
        // Tratamos 'admin' también como docente para métricas si no existen roles teacher.
        const teacherRoleSet = new Set(['teacher', 'docente', 'admin'])
        const studentsCountDirect = users.filter(u => studentRoleSet.has(roleNorm(u.role))).length
        const teachersCountDirect = users.filter(u => teacherRoleSet.has(roleNorm(u.role))).length

        // Clases
        const { data: classesRows, error: classesErr } = await supabase.from('classes').select('id,teacher_id,name')
        const classes: ClassRow[] = (classesRows || []) as ClassRow[]
        const teacherDistinctFromClasses = new Set(classes.map(c => c.teacher_id).filter(Boolean)).size

        // Matriculaciones
        const { data: enrollRows, error: enrollErr } = await supabase.from('class_enrollments').select('class_id,student_id,teacher_id')
        const enrollments: EnrollmentRow[] = (enrollRows || []) as EnrollmentRow[]
        const studentDistinctFromEnrollments = new Set(enrollments.map(e => e.student_id).filter(Boolean)).size
        const enrollmentsPerClass: Record<string, number> = {}
        enrollments.forEach((e: EnrollmentRow) => {
            if (!e.class_id) return
            enrollmentsPerClass[e.class_id] = (enrollmentsPerClass[e.class_id] || 0) + 1
        })

        // Progreso (incluye student_id para fallback de conteo)
        const { data: progressRowsData, error: progressErr } = await supabase.from('student_progress').select('class_id,progress_percentage,student_id')
        const progressRows: ProgressRow[] = (progressRowsData || []) as ProgressRow[]
        const progressAgg: Record<string, { sum: number; count: number }> = {}
        progressRows.forEach((p: ProgressRow) => {
            const cid = p.class_id
            const val = Number(p.progress_percentage)
            if (!cid || Number.isNaN(val)) return
            if (!progressAgg[cid]) progressAgg[cid] = { sum: 0, count: 0 }
            progressAgg[cid].sum += val
            progressAgg[cid].count += 1
        })
        const globalProgressVals = progressRows.map((p: ProgressRow) => Number(p.progress_percentage)).filter((n: number) => Number.isFinite(n))
        const overallAvgProgress = globalProgressVals.length ? globalProgressVals.reduce((a: number, b: number) => a + b, 0) / globalProgressVals.length : null

        // Respuestas / puntajes
        const { data: responseRowsData, error: responsesErr } = await supabase.from('student_responses').select('student_id,score,evaluation_id')
        const responseRows: ResponseRow[] = (responseRowsData || []) as ResponseRow[]
        const globalScores = responseRows.map((r: ResponseRow) => Number(r.score)).filter((n: number) => Number.isFinite(n))
        const avgScore = globalScores.length ? globalScores.reduce((a: number, b: number) => a + b, 0) / globalScores.length : null

        // Top estudiantes
        const scorePerStudent: Record<string, { sum: number; count: number }> = {}
        responseRows.forEach((r: ResponseRow) => {
            const sid = r.student_id
            const sc = Number(r.score)
            if (!sid || !Number.isFinite(sc)) return
            if (!scorePerStudent[sid]) scorePerStudent[sid] = { sum: 0, count: 0 }
            scorePerStudent[sid].sum += sc
            scorePerStudent[sid].count += 1
        })
        const topStudents = Object.entries(scorePerStudent)
            .map(([sid, v]) => ({ id: sid, avg: v.sum / v.count }))
            .sort((a: { id: string; avg: number }, b: { id: string; avg: number }) => b.avg - a.avg)
            .slice(0, 5)

        // Top docentes (por alumnos inscritos)
        const teacherStudentCounts: Record<string, number> = {}
        enrollments.forEach((e: EnrollmentRow) => {
            const tid = e.teacher_id
            if (!tid) return
            teacherStudentCounts[tid] = (teacherStudentCounts[tid] || 0) + 1
        })
        const topTeachers = Object.entries(teacherStudentCounts)
            .map(([tid, count]) => ({ id: tid, count }))
            .sort((a: { id: string; count: number }, b: { id: string; count: number }) => b.count - a.count)
            .slice(0, 5)

        // JOIN con users para enriquecer nombres/correos en top lists y clases
        const joinIds = Array.from(new Set([
            ...topStudents.map(s => s.id),
            ...topTeachers.map(t => t.id),
            ...classes.map(c => c.teacher_id).filter(Boolean) as string[],
        ]))
        let userJoinError: string | null = null
        let userMap: Record<string, { id: string; full_name: string | null; email: string | null; role: string | null }> = {}
        if (joinIds.length) {
            const { data: joinUsers, error: joinErr } = await supabase.from('users').select('id,full_name,email,role').in('id', joinIds)
            if (joinErr) {
                userJoinError = joinErr.message
            } else if (joinUsers) {
                userMap = Object.fromEntries(joinUsers.map((u: { id: string; full_name?: string | null; email?: string | null; role?: string | null }) => [
                    u.id,
                    {
                        id: u.id,
                        full_name: u.full_name ?? null,
                        email: u.email ?? null,
                        role: u.role ?? null,
                    }
                ]))
            }
        }

        const enrichedTopStudents = topStudents.map(s => ({ ...s, user: userMap[s.id] || null }))
        const enrichedTopTeachers = topTeachers.map(t => ({ ...t, user: userMap[t.id] || null }))

        // Per-class distinct students from progress (si enrollments vacío aún contamos)
        const progressStudentsPerClass: Record<string, Set<string>> = {}
        progressRows.forEach((p: ProgressRow) => {
            if (p.class_id && p.student_id) {
                if (!progressStudentsPerClass[p.class_id]) progressStudentsPerClass[p.class_id] = new Set<string>()
                progressStudentsPerClass[p.class_id].add(p.student_id)
            }
        })

        // Métricas por clase (enrollments + progress + unión)
        const classesMetrics = classes.map((c: ClassRow) => {
            const enrollCount = enrollmentsPerClass[c.id] || 0
            const prog = progressAgg[c.id]
            const classStudentIdsEnroll = new Set<string>(enrollments.filter((e: EnrollmentRow) => e.class_id === c.id).map(e => e.student_id).filter((v): v is string => Boolean(v)))
            const classStudentIdsProgress = progressStudentsPerClass[c.id] || new Set<string>()
            const combinedClassStudentIds = new Set<string>([...Array.from(classStudentIdsEnroll), ...Array.from(classStudentIdsProgress)])
            const classScores = responseRows
                .filter((r: ResponseRow) => r.student_id && combinedClassStudentIds.has(r.student_id))
                .map((r: ResponseRow) => Number(r.score))
                .filter((n: number) => Number.isFinite(n))
            const avg_score = classScores.length ? classScores.reduce((a: number, b: number) => a + b, 0) / classScores.length : null
            const avg_progress = prog && prog.count ? prog.sum / prog.count : null
            return {
                id: c.id,
                name: c.name || c.id,
                teacher_id: c.teacher_id,
                enrollments: enrollCount,
                students_progress: classStudentIdsProgress.size,
                students_total: combinedClassStudentIds.size,
                avg_progress,
                avg_score,
                teacher: c.teacher_id ? userMap[c.teacher_id] || null : null,
            }
        })

        // Fallback unión de IDs de estudiantes (matriculas, progreso, respuestas)
        const studentIdsFromEnrollments = new Set(enrollments.map(e => e.student_id).filter(Boolean) as string[])
        const studentIdsFromProgress = new Set(progressRows.map(p => p.student_id).filter(Boolean) as string[])
        const studentIdsFromResponses = new Set(responseRows.map(r => r.student_id).filter(Boolean) as string[])
        const allStudentIds = new Set<string>([...Array.from(studentIdsFromEnrollments), ...Array.from(studentIdsFromProgress), ...Array.from(studentIdsFromResponses)])

        const finalStudents = studentsCountDirect || studentDistinctFromEnrollments || allStudentIds.size
        const finalTeachers = teachersCountDirect || teacherDistinctFromClasses

        return NextResponse.json({
            counts: { students: finalStudents, teachers: finalTeachers },
            avgScore,
            overallAvgProgress,
            topStudents: enrichedTopStudents,
            topTeachers: enrichedTopTeachers,
            totalResponses: globalScores.length,
            classesMetrics,
            _debug: {
                usersError,
                classesErr: classesErr?.message || null,
                enrollErr: enrollErr?.message || null,
                progressErr: progressErr?.message || null,
                responsesErr: responsesErr?.message || null,
                distinctRoles,
                studentsCountDirect,
                teachersCountDirect,
                studentDistinctFromEnrollments,
                teacherDistinctFromClasses,
                allStudentIdsCount: allStudentIds.size,
                sourceCounts: {
                    enrollments: studentIdsFromEnrollments.size,
                    progress: studentIdsFromProgress.size,
                    responses: studentIdsFromResponses.size,
                },
                usedServiceRole: Boolean(serviceKey),
                envUrlPresent: Boolean(url),
                note: !serviceKey ? 'SUPABASE_SERVICE_ROLE_KEY ausente: usando cliente con sesión, RLS puede ocultar filas.' : null,
                userJoinError,
                joinedIdsCount: joinIds.length,
            }
        })
    } catch (err: any) {
        console.error('metrics error', err)
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}
