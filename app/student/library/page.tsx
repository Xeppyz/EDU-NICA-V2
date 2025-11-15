"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, BookOpen } from "lucide-react"

interface Material {
    id: string
    title: string
    description?: string
    url?: string
}

export default function LibraryPage() {
    const router = useRouter()
    const [materials, setMaterials] = useState<Material[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadMaterials() {
            try {
                const currentUser = await getCurrentUser()
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()

                // Try to fetch a table named `library_materials` if it exists. If the table doesn't exist,
                // the call will return an error and we show an empty state.
                const { data, error } = await supabase.from("library_materials").select("id, title, description, url").order("title", { ascending: true })

                if (!error && data) {
                    setMaterials(data as Material[])
                } else {
                    // no-op: table may not exist yet; show empty state instead
                    setMaterials([])
                }
            } catch (e) {
                console.error("Error loading library materials:", e)
                setMaterials([])
            } finally {
                setLoading(false)
            }
        }

        loadMaterials()
    }, [router])

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6" /> Biblioteca Virtual</h1>
                    <p className="text-muted-foreground">Materiales de estudio para el aprendizaje de la Lengua de Señas Nicaragüense (LSN).</p>
                </div>
                <div>
                    <Button variant="outline" onClick={() => router.push('/student/library/new')}>Añadir material</Button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">
                    <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
                    <div className="h-40 bg-muted rounded animate-pulse" />
                </div>
            ) : materials.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>No hay materiales aún</CardTitle>
                        <CardDescription>La biblioteca está vacía. Puedes añadir materiales que ayuden a los estudiantes a aprender LSN.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">Ejemplos: hojas de referencia, videos en LSN, glosarios con imágenes, documentos PDF con ejercicios.</p>
                            <Button onClick={() => router.push('/student/library/new')}>Añadir primer material</Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {materials.map((m) => (
                        <Card key={m.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> {m.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                                {m.url ? (
                                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs underline text-primary">Abrir recurso</a>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Sin enlace</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
