import { ChartContainer } from '@/components/ui/chart'
import ClientBarChart from '@/components/admin/client-bar-chart'
import { getSupabaseServerClient } from '@/lib/supabase/server'

function extractScoreFromAnswers(answers: any): number | null {
    if (!answers) return null
    const toNum = (v: any) => {
        if (v == null) return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    const direct = toNum(answers.score) ?? toNum(answers?.meta?.score) ?? toNum(answers?.summary?.score)
    if (direct != null) return direct
    const items = answers.items || answers.questions || answers.responses
    if (Array.isArray(items) && items.length) {
        const itemScores = items.map((it: any) => toNum(it?.score)).filter((x: any): x is number => x != null)
        if (itemScores.length) return itemScores.reduce((a: number, b: number) => a + b, 0)
        const correct = items.filter((it: any) => it?.correct === true || it?.isCorrect === true).length
        if (correct) return correct
    }
    return null
}

export default async function AdminIndexPage() {
    const supabase = await getSupabaseServerClient()

    // counts
    const [{ count: studentsCount }, { count: teachersCount }] = await Promise.all([
        (async () => {
            const { count } = await supabase.from('users').select('id', { count: 'exact' }).eq('role', 'student')
            return { count: count || 0 }
        })(),
        (async () => {
            const { count } = await supabase.from('users').select('id', { count: 'exact' }).eq('role', 'teacher')
            return { count: count || 0 }
        })(),
    ])

    // avg score and top students
    const { data: responses } = await supabase.from('student_responses').select('student_id,answers')
    const scores = (responses || []).map((r: any) => extractScoreFromAnswers(r.answers)).filter((s: any): s is number => s != null)
    const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null

    const studentMap: Record<string, { sum: number; count: number }> = {}
        ; (responses || []).forEach((r: any) => {
            const id = r.student_id
            const sc = extractScoreFromAnswers(r.answers)
            if (sc == null) return
            if (!studentMap[id]) studentMap[id] = { sum: 0, count: 0 }
            studentMap[id].sum += sc
            studentMap[id].count += 1
        })

    const studentAvgs = Object.entries(studentMap).map(([id, v]) => ({ id, avg: v.sum / v.count }))
    studentAvgs.sort((a, b) => b.avg - a.avg)
    const topStudentIds = studentAvgs.slice(0, 5).map(s => s.id)

    let topStudents: any[] = []
    if (topStudentIds.length) {
        const { data: users } = await supabase.from('users').select('id,email,full_name:full_name,role').in('id', topStudentIds)
        const usersById: Record<string, any> = {}
            ; (users || []).forEach((u: any) => (usersById[u.id] = u))
        topStudents = studentAvgs.slice(0, 5).map(s => ({ id: s.id, avg: s.avg, user: usersById[s.id] || null }))
    }

    // top teachers
    const { data: classes } = await supabase.from('classes').select('id,teacher_id')
    const classById: Record<string, string> = {}
        ; (classes || []).forEach((c: any) => { classById[c.id] = c.teacher_id })

    const { data: enrollments } = await supabase.from('class_enrollments').select('class_id')
    const teacherCounts: Record<string, number> = {}
        ; (enrollments || []).forEach((e: any) => {
            const tid = classById[e.class_id]
            if (!tid) return
            teacherCounts[tid] = (teacherCounts[tid] || 0) + 1
        })

    const teacherArr = Object.entries(teacherCounts).map(([id, count]) => ({ id, count }))
    teacherArr.sort((a, b) => b.count - a.count)
    const topTeacherIds = teacherArr.slice(0, 5).map(t => t.id)
    let topTeachers: any[] = []
    if (topTeacherIds.length) {
        const { data: tusers } = await supabase.from('users').select('id,email,full_name,role').in('id', topTeacherIds)
        const tById: Record<string, any> = {}
            ; (tusers || []).forEach((u: any) => (tById[u.id] = u))
        topTeachers = teacherArr.slice(0, 5).map(t => ({ id: t.id, count: t.count, user: tById[t.id] || null }))
    }

    // per-class metrics
    const { data: classesFull } = await supabase.from('classes').select('id,name,teacher_id')
    const { data: enrollsAll } = await supabase.from('class_enrollments').select('class_id')
    const enrollCounts: Record<string, number> = {}
        ; (enrollsAll || []).forEach((e: any) => { enrollCounts[e.class_id] = (enrollCounts[e.class_id] || 0) + 1 })

    const { data: progressAll } = await supabase.from('student_progress').select('class_id,progress_percentage')
    const progressMap: Record<string, { sum: number; count: number }> = {}
        ; (progressAll || []).forEach((p: any) => {
            const cid = p.class_id
            const val = Number(p.progress_percentage)
            if (Number.isNaN(val)) return
            if (!progressMap[cid]) progressMap[cid] = { sum: 0, count: 0 }
            progressMap[cid].sum += val
            progressMap[cid].count += 1
        })

    const classesMetrics = await Promise.all((classesFull || []).map(async (c: any) => {
        const enrollments = enrollCounts[c.id] || 0
        const prog = progressMap[c.id]
        const avg_progress = prog && prog.count ? prog.sum / prog.count : null

        const { data: lessonsForClass } = await supabase.from('lessons').select('id').eq('class_id', c.id)
        const lessonIds = (lessonsForClass || []).map((l: any) => l.id)

        let activityIds: string[] = []
        if (lessonIds.length > 0) {
            const { data: activitiesForLessons } = await supabase.from('activities').select('id').in('lesson_id', lessonIds)
            activityIds = (activitiesForLessons || []).map((a: any) => a.id)
        }

        let evaluationIds: string[] = []
        if (activityIds.length > 0) {
            const { data: evaluationsForActivities } = await supabase.from('evaluations').select('id').in('activity_id', activityIds)
            evaluationIds = (evaluationsForActivities || []).map((e: any) => e.id)
        }

        const evaluations_count = evaluationIds.length

        let avg_score: number | null = null
        if (evaluationIds.length > 0) {
            const { data: respData } = await supabase.from('student_responses').select('answers').in('evaluation_id', evaluationIds)
            const scoresForClass = (respData || []).map((r: any) => extractScoreFromAnswers(r.answers)).filter((s: any): s is number => s != null)
            if (scoresForClass.length) {
                avg_score = scoresForClass.reduce((a: number, b: number) => a + b, 0) / scoresForClass.length
            }
        }

        return {
            id: c.id,
            name: c.name || c.id,
            teacher_id: c.teacher_id,
            enrollments,
            avg_progress,
            avg_score,
            evaluations_count,
        }
    }))

    const metrics = {
        counts: { students: studentsCount, teachers: teachersCount },
        avgScore,
        topStudents,
        topTeachers,
        totalResponses: scores.length,
        classesMetrics,
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold">Panel de administración</h1>
            <p className="mt-2 text-sm text-muted-foreground">Usa el menú para administrar docentes, estudiantes y crear usuarios.</p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Docentes</h3>
                    <p className="text-sm text-muted-foreground">Ver y administrar cuentas de docentes.</p>
                    <div className="mt-3 text-2xl font-semibold">{metrics.counts.teachers ?? 0}</div>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Estudiantes</h3>
                    <p className="text-sm text-muted-foreground">Ver y administrar cuentas de estudiantes.</p>
                    <div className="mt-3 text-2xl font-semibold">{metrics.counts.students ?? 0}</div>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Respuestas / Puntuación</h3>
                    <p className="text-sm text-muted-foreground">Resumen rápido de evaluaciones.</p>
                    <div className="mt-3">
                        <div className="text-lg font-semibold">Avg score: {metrics.avgScore ? metrics.avgScore.toFixed(2) : '—'}</div>
                        <div className="text-sm text-muted-foreground">Total responses: {metrics.totalResponses ?? 0}</div>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Top estudiantes (por promedio)</h3>
                    <ul className="mt-3 space-y-2">
                        {(metrics.topStudents || []).map((s: any) => (
                            <li key={s.id} className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{s.user?.full_name || s.user?.email || s.id}</div>
                                    <div className="text-sm text-muted-foreground">{s.user?.email || '-'}</div>
                                </div>
                                <div className="font-semibold">{(s.avg ?? 0).toFixed(2)}</div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Top docentes (por alumnos inscritos)</h3>
                    <ul className="mt-3 space-y-2">
                        {(metrics.topTeachers || []).map((t: any) => (
                            <li key={t.id} className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{t.user?.full_name || t.user?.email || t.id}</div>
                                    <div className="text-sm text-muted-foreground">{t.user?.email || '-'}</div>
                                </div>
                                <div className="font-semibold">{t.count}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Promedio de progreso por clase</h3>
                    <ChartContainer id="class-progress" config={{ progress: { color: '#06b6d4', label: 'Avg progress' } }}>
                        <ClientBarChart
                            data={(metrics.classesMetrics || []).map((c: any) => ({ name: c.name, avg_progress: c.avg_progress || 0 })).sort((a: any, b: any) => b.avg_progress - a.avg_progress)}
                            dataKey="avg_progress"
                            fill="var(--color-progress)"
                        />
                    </ChartContainer>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-medium">Matriculaciones por clase</h3>
                    <ChartContainer id="class-enrolls" config={{ enrolls: { color: '#10b981', label: 'Enrollments' } }}>
                        <ClientBarChart
                            data={(metrics.classesMetrics || []).map((c: any) => ({ name: c.name, enrollments: c.enrollments || 0 })).sort((a: any, b: any) => b.enrollments - a.enrollments)}
                            dataKey="enrollments"
                            fill="var(--color-enrolls)"
                        />
                    </ChartContainer>
                </div>
            </div>
        </div>
    )
}
