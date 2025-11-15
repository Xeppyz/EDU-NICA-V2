import React from "react"
import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"

interface Props {
    params: { classId: string; activityId: string }
}

export default async function ActivityDetailPage({ params }: Props) {
    // In Next.js params may be a Promise in some runtimes — unwrap it to safely access values
    const { classId, activityId } = await params as { classId: string; activityId: string }
    const supabase = await getSupabaseServerClient()

    const activityResp = await supabase.from("activities").select("*").eq("id", activityId).single()
    console.debug("activityResp:", activityResp)
    if (activityResp.error) {
        console.error("Error loading activity:", activityResp.error, activityResp)
        return (
            <div className="p-6">
                <h1 className="text-xl font-semibold">Error al cargar la actividad</h1>
                <pre className="mt-2 text-sm text-red-600">{String(activityResp.error.message || JSON.stringify(activityResp.error))}</pre>
                <p className="text-sm text-muted-foreground mt-2">Esto puede deberse a RLS; revisa las políticas o la sesión en cookies.</p>
            </div>
        )
    }
    const activity = activityResp.data
    if (!activity) return notFound()

    // Load lesson to verify class ownership and show lesson info
    const lessonResp = await supabase.from("lessons").select("id, title, class_id").eq("id", activity.lesson_id).single()
    console.debug("lessonResp for activity:", lessonResp)
    if (lessonResp.error) {
        console.error("Error loading lesson for activity:", lessonResp.error, lessonResp)
        return (
            <div className="p-6">
                <h1 className="text-xl font-semibold">Error al cargar la lección asociada</h1>
                <pre className="mt-2 text-sm text-red-600">{String(lessonResp.error?.message || JSON.stringify(lessonResp.error))}</pre>
            </div>
        )
    }
    const lesson = lessonResp.data
    if (!lesson) return notFound()
    if (String(lesson.class_id) !== String(classId)) {
        console.error(`Class id mismatch: expected ${classId} but lesson.class_id=${lesson.class_id}`)
        return notFound()
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{activity.title}</h1>
                    <p className="text-sm text-muted-foreground">Lección: {lesson.title}</p>
                </div>
                <div>
                    <a href={`/dashboard/classes/${classId}`} className="text-sm text-primary underline">
                        ← Volver a la clase
                    </a>
                </div>
            </div>

            <div className="p-4 border rounded">
                <p>
                    <strong>Tipo:</strong> {activity.type}
                </p>
                <p>
                    <strong>ID de la actividad:</strong> {activity.id}
                </p>
            </div>
        </div>
    )
}
