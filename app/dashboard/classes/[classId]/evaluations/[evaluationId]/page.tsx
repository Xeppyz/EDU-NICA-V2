import React from "react"
import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"

interface Props {
    params: { classId: string; evaluationId: string }
}

export default async function EvaluationDetailPage({ params }: Props) {
    // Unwrap params which can be a Promise in Next.js server runtime
    const { classId, evaluationId } = await params as { classId: string; evaluationId: string }
    const supabase = await getSupabaseServerClient()

    const evaluationResp = await supabase.from("evaluations").select("*").eq("id", evaluationId).single()
    console.debug("evaluationResp:", evaluationResp)
    if (evaluationResp.error) {
        // Show useful debug output instead of silently returning notFound so we can see the RLS / select error
        console.error("Error loading evaluation:", evaluationResp.error, evaluationResp)
        return (
            <div className="p-6">
                <h1 className="text-xl font-semibold">Error al cargar la evaluación</h1>
                <pre className="mt-2 text-sm text-red-600">{String(evaluationResp.error.message || JSON.stringify(evaluationResp.error))}</pre>
                <p className="text-sm text-muted-foreground mt-2">Si esto es una restricción RLS, aplica las políticas en la base de datos o revisa el `service_role`/cookies.</p>
            </div>
        )
    }
    const evaluation = evaluationResp.data
    if (!evaluation) return notFound()

    // Load activity and lesson to verify class
    const activityResp = await supabase.from("activities").select("id, lesson_id, title").eq("id", evaluation.activity_id).single()
    console.debug("activityResp for evaluation:", activityResp)
    if (activityResp.error || !activityResp.data) {
        console.error("Error loading activity for evaluation:", activityResp.error, activityResp)
        return (
            <div className="p-6">
                <h1 className="text-xl font-semibold">Actividad no encontrada</h1>
                <pre className="mt-2 text-sm text-red-600">{String((activityResp.error && (activityResp.error.message || JSON.stringify(activityResp.error))) || 'Actividad no existe')}</pre>
            </div>
        )
    }
    const activity = activityResp.data

    const lessonResp = await supabase.from("lessons").select("id, title, class_id").eq("id", activity.lesson_id).single()
    console.debug("lessonResp for evaluation:", lessonResp)
    if (lessonResp.error || !lessonResp.data) {
        console.error("Error loading lesson for evaluation:", lessonResp.error, lessonResp)
        return (
            <div className="p-6">
                <h1 className="text-xl font-semibold">Lección no encontrada</h1>
                <pre className="mt-2 text-sm text-red-600">{String((lessonResp.error && (lessonResp.error.message || JSON.stringify(lessonResp.error))) || 'Lección no existe')}</pre>
            </div>
        )
    }
    const lesson = lessonResp.data

    if (String(lesson.class_id) !== String(classId)) {
        console.error(`Class id mismatch: expected ${classId} but lesson.class_id=${lesson.class_id}`)
        return notFound()
    }

    // Questions stored as JSONB
    const questions = evaluation.questions || []

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{evaluation.title}</h1>
                    <p className="text-sm text-muted-foreground">Actividad: {activity.title} — Lección: {lesson.title}</p>
                </div>
                <div>
                    <a href={`/dashboard/classes/${classId}`} className="text-sm text-primary underline">
                        ← Volver a la clase
                    </a>
                </div>
            </div>

            <div className="space-y-4">
                {questions.length === 0 ? (
                    <div className="p-4 border rounded text-muted-foreground">Sin preguntas en esta evaluación.</div>
                ) : (
                    questions.map((q: any, idx: number) => (
                        <div key={q.id || idx} className="p-4 border rounded">
                            <h3 className="font-medium">{idx + 1}. {q.text}</h3>
                            <ul className="mt-2 list-disc pl-5 space-y-1">
                                {(q.options || []).map((opt: string, i: number) => (
                                    <li key={i} className={i === q.correct ? "text-green-600 font-medium" : ""}>
                                        {String.fromCharCode(65 + i)}) {opt}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
