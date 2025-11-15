import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await getSupabaseServerClient()

        // helper: extract numeric score from answers JSONB (flexible to different shapes)
        function extractScoreFromAnswers(answers: any): number | null {
            if (!answers) return null
            const toNum = (v: any) => {
                if (v == null) return null
                const n = Number(v)
                return Number.isFinite(n) ? n : null
            }

            // common direct locations
            const direct = toNum(answers.score) ?? toNum(answers?.meta?.score) ?? toNum(answers?.summary?.score)
            if (direct != null) return direct

            // look for items/questions array with per-item score or correct flags
            const items = answers.items || answers.questions || answers.responses
            if (Array.isArray(items) && items.length) {
                // sum numeric item.score if present
                const itemScores = items.map((it: any) => toNum(it?.score)).filter((x: any): x is number => x != null)
                if (itemScores.length) return itemScores.reduce((a: number, b: number) => a + b, 0)

                // fallback: count correct flags (treat each correct as 1)
                const correct = items.filter((it: any) => it?.correct === true || it?.isCorrect === true).length
                if (correct) return correct
            }

            return null
        }

        // counts of users by role (public.users table)
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

        // average score across student_responses
        // NOTE: schema stores answers as JSONB (student_responses.answers). We attempt to extract a numeric `score` field from answers.
        const { data: responses } = await supabase.from('student_responses').select('student_id,answers')
        const scores = (responses || []).map((r: any) => extractScoreFromAnswers(r.answers)).filter((s: any): s is number => s != null)
        const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null

        // top students by average score (extract score from answers JSONB)
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

        // top teachers by student counts (via classes + class_enrollments)
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

        // Per-class metrics: enrollments, avg progress, avg score, evaluations count
        const { data: classesFull } = await supabase.from('classes').select('id,name,teacher_id')
        const classIds = (classesFull || []).map((c: any) => c.id)

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

        // Per-class metrics: for each class follow the pattern lessons -> activities -> evaluations -> responses
        const classesMetrics = await Promise.all((classesFull || []).map(async (c: any) => {
            const enrollments = enrollCounts[c.id] || 0
            const prog = progressMap[c.id]
            const avg_progress = prog && prog.count ? prog.sum / prog.count : null

            // Get lessons for this class
            const { data: lessonsForClass } = await supabase.from('lessons').select('id').eq('class_id', c.id)
            const lessonIds = (lessonsForClass || []).map((l: any) => l.id)

            // Get activities for those lessons
            let activityIds: string[] = []
            if (lessonIds.length > 0) {
                const { data: activitiesForLessons } = await supabase.from('activities').select('id').in('lesson_id', lessonIds)
                activityIds = (activitiesForLessons || []).map((a: any) => a.id)
            }

            // Get evaluations for those activities
            let evaluationIds: string[] = []
            if (activityIds.length > 0) {
                const { data: evaluationsForActivities } = await supabase.from('evaluations').select('id').in('activity_id', activityIds)
                evaluationIds = (evaluationsForActivities || []).map((e: any) => e.id)
            }

            // Count evaluations
            const evaluations_count = evaluationIds.length

            // Get responses for these evaluations and compute avg score
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

        return NextResponse.json({
            counts: { students: studentsCount, teachers: teachersCount },
            avgScore,
            topStudents,
            topTeachers,
            totalResponses: scores.length,
            classesMetrics,
        })
    } catch (err: any) {
        console.error('metrics error', err)
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}
