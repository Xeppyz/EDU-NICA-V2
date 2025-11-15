"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TeacherOnboardingPage() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [lessonTitle, setLessonTitle] = useState("")
    const [lessonDesc, setLessonDesc] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError("")

        const supabase = getSupabaseClient()
        const {
            data: { user },
            error: userErr,
        } = await supabase.auth.getUser()

        if (userErr || !user) {
            setError("No se pudo obtener el usuario. Asegúrate de iniciar sesión.")
            setLoading(false)
            return
        }

        // Create class
        const { data: classData, error: classErr } = await supabase
            .from("classes")
            .insert([
                {
                    teacher_id: user.id,
                    name,
                    description,
                },
            ])
            .select("id")
            .single()

        if (classErr || !classData) {
            setError(classErr?.message || "Error creando la clase")
            setLoading(false)
            return
        }

        // Create initial lesson
        const { error: lessonErr } = await supabase.from("lessons").insert([
            {
                class_id: classData.id,
                title: lessonTitle,
                description: lessonDesc,
            },
        ])

        if (lessonErr) {
            setError(lessonErr.message)
            setLoading(false)
            return
        }

        setLoading(false)
        router.push(`/dashboard/classes/${classData.id}`)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>Onboarding Docente — Crea tu primera clase</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nombre de la clase</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Descripción</label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>

                        <hr />

                        <div>
                            <label className="block text-sm font-medium mb-1">Título de la lección inicial</label>
                            <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Descripción de la lección</label>
                            <Input value={lessonDesc} onChange={(e) => setLessonDesc(e.target.value)} />
                        </div>

                        {error && <div className="text-sm text-destructive">{error}</div>}

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Creando..." : "Crear clase y lección"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
