"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Trophy } from "lucide-react"

export default function StudentRankingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [boards, setBoards] = useState<any[]>([])

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const currentUser = await getCurrentUser()
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()

                const { data: enrollments, error: enrollErr } = await supabase
                    .from("class_enrollments")
                    .select(`class_id, classes:class_id(id, name)`)
                    .eq("student_id", currentUser.id)

                if (enrollErr) throw enrollErr

                const classes = (enrollments || []).map((e: any) => e.classes)

                const resultBoards: any[] = []

                for (const cls of classes) {
                    try {
                        const challengesResp = await supabase
                            .from("challenges")
                            .select("*")
                            .eq("class_id", cls.id)

                        if (challengesResp.error) throw challengesResp.error
                        const challenges = challengesResp.data || []
                        const challengeIds = challenges.map((c: any) => c.id)

                        if (challengeIds.length === 0) {
                            resultBoards.push({ classId: cls.id, className: cls.name, board: [] })
                            continue
                        }

                        const resp = await supabase
                            .from("challenge_responses")
                            .select("*, users:student_id(full_name, email)")
                            .in("challenge_id", challengeIds)

                        if (resp.error) throw resp.error
                        const responses = resp.data || []

                        const challengesById: Record<string, any> = {}
                        challenges.forEach((c: any) => (challengesById[c.id] = c))

                        const perStudent: Record<string, { student_id: string; name?: string; email?: string; correct: number; total: number }> = {}

                        responses.forEach((r: any) => {
                            const sid = r.student_id
                            if (!perStudent[sid]) perStudent[sid] = { student_id: sid, name: r.users?.full_name, email: r.users?.email, correct: 0, total: 0 }
                            const ch = challengesById[r.challenge_id]
                            if (!ch) return

                            const payload = ch.payload || {}
                            let correctCount = 0
                            let totalCount = 1

                            try {
                                if (ch.type === "multiple_choice" || ch.type === "select_image") {
                                    const selected = r.answers?.selected
                                    const options = Array.isArray(payload.options) ? payload.options : []
                                    const correctIndex = typeof payload.correct_index === "number" ? payload.correct_index : null
                                    const correctOptionId = correctIndex !== null && options[correctIndex] ? options[correctIndex].id : null
                                    if (selected && correctOptionId && selected === correctOptionId) correctCount = 1
                                } else if (ch.type === "matching") {
                                    const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
                                    const matches = Array.isArray(r.answers?.matches) ? r.answers.matches : []
                                    totalCount = pairs.length || 1
                                    let correctMatches = 0
                                    matches.forEach((m: any) => {
                                        const selectedId = m.selectedId ?? m.right
                                        if (selectedId && selectedId === m.pairId) {
                                            correctMatches++
                                        } else {
                                            const pair = pairs.find((p: any) => p.id === m.pairId)
                                            if (pair && (selectedId === pair.right || selectedId === pair.id || selectedId === pair.left)) correctMatches++
                                        }
                                    })
                                    correctCount = correctMatches
                                } else {
                                    // non auto-graded types
                                    correctCount = 0
                                    totalCount = 0
                                }
                            } catch (e) {
                                console.warn("Error scoring response", e)
                            }

                            perStudent[sid].correct += correctCount
                            perStudent[sid].total += totalCount
                        })

                        const board = Object.values(perStudent).map((s) => ({
                            ...s,
                            percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
                        }))

                        board.sort((a, b) => b.percentage - a.percentage || b.correct - a.correct)

                        resultBoards.push({ classId: cls.id, className: cls.name, board })
                    } catch (e) {
                        console.error("Error building board for class", cls, e)
                        resultBoards.push({ classId: cls.id, className: cls.name, board: [] })
                    }
                }

                setBoards(resultBoards)
            } catch (error) {
                console.error("Error loading ranking:", error)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [router])

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-sm text-muted-foreground">Cargando ranking...</p>
            </div>
        )
    }

    if (boards.length === 0) {
        return (
            <div className="p-6 space-y-4">
                <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-500" />Ranking</h1>
                <Card>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No estás inscrito en ninguna clase o aún no hay datos para mostrar.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-500" />Ranking</h1>
            <div className="space-y-6">
                {boards.map((b) => (
                    <div key={b.classId}>
                        <h2 className="text-lg font-semibold">{b.className}</h2>
                        {b.board.length === 0 ? (
                            <Card>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">No hay resultados para esta clase aún.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2 mt-2">
                                {b.board.slice(0, 10).map((row: any, idx: number) => (
                                    <Card key={row.student_id} className="p-3">
                                        <CardContent className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="font-medium">{idx + 1}. {row.name || row.student_id}</p>
                                                <p className="text-sm text-muted-foreground">{row.email || ''}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">{row.percentage}%</p>
                                                <p className="text-xs text-muted-foreground">{row.correct} / {row.total} aciertos</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
