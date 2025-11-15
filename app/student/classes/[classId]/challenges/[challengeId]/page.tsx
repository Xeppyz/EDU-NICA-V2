"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function StudentChallengePage() {
    const router = useRouter()
    const params = useParams() as { classId?: string; challengeId?: string }
    const classId = params.classId || ""
    const challengeId = params.challengeId || ""

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [challenge, setChallenge] = useState<any | null>(null)

    // type-specific state
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
    const [fillText, setFillText] = useState("")
    const [openText, setOpenText] = useState("")
    const [matchingMap, setMatchingMap] = useState<Record<string, string>>({})
    const [existingResponse, setExistingResponse] = useState<any | null>(null)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            try {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()
                const { data, error } = await supabase
                    .from("challenges")
                    .select("*, classes:class_id(id, name)")
                    .eq("id", challengeId)
                    .single()

                if (error || !data) {
                    console.error("Challenge load error:", error)
                    router.push("/student")
                    return
                }

                if (mounted) {
                    setChallenge(data)
                    // initialize default states from payload
                    const payload = data.payload || {}
                    if (data.type === "multiple_choice" && Array.isArray(payload.options) && payload.options.length > 0) {
                        setSelectedOptionId(payload.options[0].id || null)
                    }
                    if (data.type === "fill_blank" && payload.prompt) {
                        setFillText("")
                    }
                    if (data.type === "open_ended") setOpenText("")
                    if (data.type === "matching" && Array.isArray(payload.pairs)) {
                        // default no matches
                        const map: Record<string, string> = {}
                        payload.pairs.forEach((p: any) => {
                            map[p.id] = ""
                        })
                        setMatchingMap(map)
                    }

                    // load existing response by this student for this challenge
                    try {
                        const respExisting = await supabase
                            .from("challenge_responses")
                            .select("*")
                            .eq("challenge_id", challengeId)
                            .eq("student_id", currentUser.id)
                            .limit(1)
                            .single()
                        if (!respExisting.error && respExisting.data) {
                            setExistingResponse(respExisting.data)
                            // populate UI with previous answers if present
                            const prev = respExisting.data
                            if (data.type === "multiple_choice" && prev.answers?.selected) setSelectedOptionId(prev.answers.selected)
                            if (data.type === "fill_blank" && prev.answers?.text) setFillText(prev.answers.text)
                            if (data.type === "open_ended" && prev.answers?.text) setOpenText(prev.answers.text)
                            if (data.type === "matching" && Array.isArray(prev.answers?.matches)) {
                                const mMap: Record<string, string> = {}
                                prev.answers.matches.forEach((m: any) => {
                                    // support both older shape {pairId, right} and new {pairId, selectedId}
                                    mMap[m.pairId] = m.selectedId ?? m.right ?? ""
                                })
                                setMatchingMap(mMap)
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            } catch (e) {
                console.error(e)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        load()
        return () => {
            mounted = false
        }
    }, [challengeId, router])

    const handleSubmit = async () => {
        if (!user) return router.push("/auth/login")
        if (!challenge) return

        // build answers based on type
        let answers: any = {}
        const payload = challenge.payload || {}
        if (challenge.type === "multiple_choice") {
            if (!selectedOptionId) return alert("Selecciona una opción")
            answers = { selected: selectedOptionId }
        } else if (challenge.type === "fill_blank") {
            if (!fillText.trim()) return alert("Escribe la respuesta")
            answers = { text: fillText }
        } else if (challenge.type === "select_image") {
            if (!selectedOptionId) return alert("Selecciona la imagen correcta")
            answers = { selected: selectedOptionId }
        } else if (challenge.type === "matching") {
            // matchingMap: key = pair id left? we stored pairs as objects with id/left/right
            answers = { matches: Object.entries(matchingMap).map(([pairId, right]) => ({ pairId, right })) }
        } else if (challenge.type === "open_ended") {
            if (!openText.trim()) return alert("Escribe tu respuesta")
            answers = { text: openText }
        }

        try {
            setSubmitting(true)
            const supabase = getSupabaseClient()
            const toInsert = {
                challenge_id: challenge.id,
                student_id: user.id,
                answers,
                completed_at: new Date().toISOString(),
            }
            const { data, error } = await supabase.from("challenge_responses").insert([toInsert]).select().single()
            if (error) throw error
            alert("Respuesta enviada. ¡Bien hecho!")
            router.push("/student")
        } catch (err: any) {
            console.error("Submit error:", err)
            alert((err && err.message) || "Error enviando la respuesta")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="p-6">Cargando...</div>
    if (!challenge) return <div className="p-6">Desafío no encontrado</div>

    const payload = challenge.payload || {}

    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle>{challenge.title}</CardTitle>
                    <CardDescription>{challenge.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">Clase: {challenge.classes?.name || classId}</p>

                    {/* Render form by type */}
                    {challenge.type === "multiple_choice" && (
                        <div className="space-y-3">
                            {Array.isArray(payload.options) && payload.options.map((opt: any) => (
                                <label key={opt.id} className="flex items-center gap-2">
                                    <input type="radio" name="mc" checked={selectedOptionId === opt.id} onChange={() => setSelectedOptionId(opt.id)} />
                                    <span>{opt.text}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {challenge.type === "fill_blank" && (
                        <div>
                            <p className="mb-2">{payload.prompt}</p>
                            <Textarea value={fillText} onChange={(e) => setFillText(e.target.value)} />
                        </div>
                    )}

                    {challenge.type === "select_image" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Array.isArray(payload.options) && payload.options.map((opt: any) => (
                                <label key={opt.id} className="border p-2 rounded cursor-pointer">
                                    <input className="mr-2" type="radio" name="select_image" checked={selectedOptionId === opt.id} onChange={() => setSelectedOptionId(opt.id)} />
                                    <div className="flex items-center gap-2">
                                        {opt.imageUrl ? <img src={opt.imageUrl} alt={opt.label} className="w-24 h-24 object-cover" /> : null}
                                        <span>{opt.label}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    {challenge.type === "matching" && (
                        <div className="space-y-2">
                            {Array.isArray(payload.pairs) && payload.pairs.map((p: any) => (
                                <div key={p.id} className="flex items-center gap-2">
                                    <div className="flex-1">{p.left}</div>
                                    <select value={matchingMap[p.id] || ""} onChange={(e) => setMatchingMap({ ...matchingMap, [p.id]: e.target.value })} className="px-2 py-1 border rounded">
                                        <option value="">-- Emparejar --</option>
                                        {payload.pairs.map((q: any) => (
                                            <option key={q.id} value={q.id}>{q.right}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    {challenge.type === "open_ended" && (
                        <div>
                            <p className="mb-2">{payload.prompt}</p>
                            <Textarea value={openText} onChange={(e) => setOpenText(e.target.value)} />
                        </div>
                    )}

                    <div className="mt-4 flex gap-2">
                        <Button onClick={() => router.back()} variant="outline">Volver</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Enviando..." : "Enviar respuesta"}</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
