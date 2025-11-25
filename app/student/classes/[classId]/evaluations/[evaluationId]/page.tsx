
"use client"


import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import EvaluationRenderer from "@/components/evaluations/EvaluationRenderer"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { getEvaluationTypeLabel } from "@/lib/evaluations"

interface Question {
    text: string
    options?: string[]
    correct?: number
    imageUrl?: string
    lsnVideoUrl?: string
}

interface Evaluation {
    id: string
    title: string
    questions: any[]
    type?: string
    activity_id?: string
    start_at?: string | null
    due_at?: string | null
    attempts_allowed?: number
}

export default function EvaluationPage() {
    const router = useRouter()
    const params = useParams()
    const evaluationId = params.evaluationId as string
    const classId = params.classId as string

    const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
    const [attemptsUsed, setAttemptsUsed] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState<number[]>([])
    const [submitted, setSubmitted] = useState(false)
    const [score, setScore] = useState(0)
    const [savedAnswers, setSavedAnswers] = useState<any>(null)

    useEffect(() => {
        async function loadEvaluation() {
            try {
                const currentUser = await getCurrentUser()
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()
                const { data: evaluationData, error: evalError } = await supabase
                    .from("evaluations")
                    .select("*")
                    .eq("id", evaluationId)
                    .single()

                if (evalError) {
                    console.error("Error fetching evaluation:", evalError)
                }

                if (evaluationData) {
                    setEvaluation(evaluationData)
                    setAnswers(new Array(evaluationData.questions?.length || 0).fill(-1))

                    // count previous attempts by current student for this evaluation
                    try {
                        const myResponses = await supabase
                            .from("student_responses")
                            .select("id", { count: "exact" })
                            .eq("evaluation_id", evaluationData.id)
                            .eq("student_id", currentUser.id)

                        const count = (myResponses.count as number) || (myResponses.data || []).length || 0
                        setAttemptsUsed(count)
                    } catch (e) {
                        // ignore counting errors
                        console.error("Error counting previous responses:", e)
                    }
                }
            } catch (error) {
                console.error("Error loading evaluation:", error)
            } finally {
                setLoading(false)
            }
        }

        loadEvaluation()
    }, [evaluationId, router])

    const saveResponse = async (answersPayload: any, finalScore: number) => {
        if (!evaluation) return
        setScore(finalScore)

        // enforce attempts and deadlines before saving
        try {
            const now = new Date()
            if (evaluation.start_at) {
                const start = new Date(evaluation.start_at)
                if (now < start) {
                    alert("Esta evaluación no está abierta todavía.")
                    return
                }
            }
            if (evaluation.due_at) {
                const due = new Date(evaluation.due_at)
                if (now > due) {
                    alert("El plazo para esta evaluación ya expiró.")
                    return
                }
            }
            if ((evaluation.attempts_allowed || 1) <= attemptsUsed) {
                alert("Has agotado el número de intentos permitidos para esta evaluación.")
                return
            }
        } catch (e) {
            console.error("Validation error before saving response:", e)
            return
        }

        setSubmitted(true)

        try {
            const currentUser = await getCurrentUser()
            if (!currentUser || !evaluation) return

            const supabase = getSupabaseClient()
            const resp = await supabase
                .from("student_responses")
                .insert([
                    {
                        student_id: currentUser.id,
                        evaluation_id: evaluation.id,
                        answers: answersPayload,
                        score: finalScore,
                        completed_at: new Date().toISOString(),
                    },
                ])
                .select()

            if (resp.error) {
                console.error("Error saving response:", resp.error)
                setSubmitted(false)
            } else {
                setSavedAnswers(answersPayload)
                setAttemptsUsed((c) => c + 1)

                // Mark lesson as completed in student_progress
                try {
                    if (evaluation.activity_id) {
                        const activityResp = await supabase
                            .from("activities")
                            .select("lesson_id")
                            .eq("id", evaluation.activity_id)
                            .single()
                        const lessonId = activityResp.data?.lesson_id
                        if (lessonId) {
                            const upsertResp = await supabase.from("student_progress").upsert(
                                {
                                    student_id: currentUser.id,
                                    class_id: classId,
                                    lesson_id: lessonId,
                                    progress_percentage: 100,
                                    completed: true,
                                    last_accessed: new Date().toISOString(),
                                },
                                { onConflict: ["student_id", "class_id", "lesson_id"] }
                            )
                            if (upsertResp.error) console.error("Error upserting progress:", upsertResp.error)
                        }
                    }
                } catch (e) {
                    console.error("Error marking lesson progress after response:", e)
                }
            }
        } catch (error) {
            console.error("Error saving response:", error)
            setSubmitted(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
        )
    }

    if (!evaluation) {
        return (
            <div className="p-6">
                <p>No se encontró la evaluación</p>
                <Button onClick={() => router.back()} className="mt-4">
                    Volver
                </Button>
            </div>
        )
    }

    const isQuiz = (evaluation?.type || "quiz") === "quiz"
    const question = isQuiz ? (evaluation.questions[currentQuestion] as Question) : null
    const currentAnswer = answers[currentQuestion]

    // availability checks
    const now = new Date()
    const evalStart = evaluation?.start_at ? new Date(evaluation.start_at) : null
    const evalDue = evaluation?.due_at ? new Date(evaluation.due_at) : null
    const allowedAttempts = evaluation?.attempts_allowed || 1
    const hasAttemptsLeft = attemptsUsed < allowedAttempts
    const isOpen = (!evalStart || now >= evalStart) && (!evalDue || now <= evalDue)
    const canTakeEvaluation = isOpen && hasAttemptsLeft

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <Button variant="outline" onClick={() => router.back()} className="mb-6">
                ← Volver
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>{evaluation.title}</CardTitle>
                    <CardDescription>
                        {isQuiz ? (
                            <>Pregunta {currentQuestion + 1} de {evaluation.questions.length}</>
                        ) : (
                            <>Tipo: {getEvaluationTypeLabel(evaluation.type)}</>
                        )}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* If evaluation is not available or attempts exhausted, show a friendly message */}
                    {!submitted && !canTakeEvaluation ? (
                        <div className="p-6 text-center">
                            {!isOpen ? (
                                <p className="text-sm text-muted-foreground">
                                    Esta evaluación no está disponible en este momento{evalStart ? ` — abre ${evalStart.toLocaleString()}` : ''}{evalDue ? ` — vence ${evalDue.toLocaleString()}` : ''}.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">Has agotado los intentos permitidos ({attemptsUsed}/{allowedAttempts}).</p>
                            )}
                            <div className="mt-4">
                                <Button onClick={() => router.back()} variant="outline">Volver</Button>
                            </div>
                        </div>
                    ) : (
                        // Otherwise render the usual evaluation flow (quiz or renderer) or results
                        !submitted ? (
                            isQuiz ? (
                                <>
                                    {/* Progress Bar */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">Progreso</span>
                                            <span className="font-semibold">
                                                {currentQuestion + 1} / {evaluation.questions.length}
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all"
                                                style={{ width: `${((currentQuestion + 1) / Math.max(1, evaluation.questions.length)) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Question */}
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-semibold mb-4">{question?.text}</h3>

                                            {/* Question Image */}
                                            {question?.imageUrl && (
                                                <div className="mb-4 aspect-video bg-muted rounded-lg overflow-hidden">
                                                    <img
                                                        src={question.imageUrl || "/placeholder.svg"}
                                                        alt="Pregunta"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* LSN Video */}
                                            {question?.lsnVideoUrl && (
                                                <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                                        Interpretación en Lengua de Señas Nicaragüense
                                                    </p>
                                                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                                        <iframe
                                                            width="100%"
                                                            height="100%"
                                                            src={question.lsnVideoUrl}
                                                            title="Lengua de Señas"
                                                            frameBorder="0"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            className="rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Answer Options */}
                                        <div className="space-y-3">
                                            <RadioGroup value={currentAnswer === -1 ? "" : currentAnswer?.toString() || ""}>
                                                {(question?.options || []).map((option: string, i: number) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                                        onClick={() => {
                                                            const newAnswers = [...answers]
                                                            newAnswers[currentQuestion] = i
                                                            setAnswers(newAnswers)
                                                        }}
                                                    >
                                                        <RadioGroupItem value={i.toString()} id={`option-${i}`} checked={currentAnswer === i} />
                                                        <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                                                            <span className="font-medium">{String.fromCharCode(65 + i)}</span>
                                                            {" - "}
                                                            {option}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex gap-2 justify-between pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                                            disabled={currentQuestion === 0}
                                        >
                                            Anterior
                                        </Button>

                                        {currentQuestion === evaluation.questions.length - 1 ? (
                                            <Button
                                                onClick={() => {
                                                    const computedScore = Math.round((answers.filter((a, i) => a === evaluation.questions[i].correct).length / Math.max(1, evaluation.questions.length)) * 100)
                                                    saveResponse(answers, computedScore)
                                                }}
                                                disabled={answers.includes(-1)}
                                                className="flex-1 ml-2"
                                            >
                                                Enviar Evaluación
                                            </Button>
                                        ) : (
                                            <Button onClick={() => setCurrentQuestion(currentQuestion + 1)} className="flex-1 ml-2">
                                                Siguiente
                                            </Button>
                                        )}
                                    </div>

                                    {/* Answer Status */}
                                    <div className="flex gap-2 flex-wrap mt-4">
                                        {evaluation.questions.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentQuestion(i)}
                                                className={`w-8 h-8 rounded-lg border transition-colors ${i === currentQuestion
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : answers[i] === -1
                                                        ? "border-muted bg-muted"
                                                        : "border-primary bg-primary/20"
                                                    }`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <EvaluationRenderer
                                    evaluation={evaluation}
                                    onSubmit={async ({ answers: payloadAnswers, score: payloadScore }) => {
                                        await saveResponse(payloadAnswers, payloadScore)
                                    }}
                                />
                            )
                        ) : (
                            /* Results */
                            <div className="space-y-4">
                                <div className="text-center py-8">
                                    {score >= 70 ? (
                                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                    ) : score >= 50 ? (
                                        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                                    ) : (
                                        <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                                    )}
                                    <h2 className="text-3xl font-bold mb-2">{score}%</h2>
                                    <p className="text-muted-foreground mb-4">
                                        {score >= 70 ? "Excelente" : score >= 50 ? "Bueno" : "Necesitas mejorar"}
                                    </p>
                                </div>

                                {/* Review Answers - for quiz show detailed review, for other types show type-specific or generic review */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold">Revisión de Respuestas</h3>
                                    {((evaluation?.type || "quiz") === "quiz") ? (
                                        evaluation.questions.map((q: any, i: number) => {
                                            const isCorrect = answers[i] === q.correct
                                            return (
                                                <div
                                                    key={i}
                                                    className={`p-4 rounded-lg border ${isCorrect ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-destructive/50 bg-destructive/5"}`}
                                                >
                                                    <p className="font-medium mb-2">Pregunta {i + 1}: {q.text}</p>
                                                    <div className="space-y-1 text-sm">
                                                        <p>
                                                            Tu respuesta:{" "}
                                                            <span className={isCorrect ? "text-green-600" : "text-destructive"}>
                                                                {q.options[answers[i]]}
                                                            </span>
                                                        </p>
                                                        {!isCorrect && (
                                                            <p>
                                                                Respuesta correcta: <span className="text-green-600">{q.options[q.correct]}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (evaluation.type === "fill_blank") ? (
                                        // Fill-in-the-blank review
                                        (evaluation.questions || []).map((q: any, i: number) => {
                                            const imageSrc = q?.imageUrl ? q.imageUrl : q?.imageStoragePath ? `/api/library/object?path=${encodeURIComponent(q.imageStoragePath)}` : q?.image_storage_path ? `/api/library/object?path=${encodeURIComponent(q.image_storage_path)}` : null
                                            return (
                                                <div key={q.id || i} className="p-4 rounded-lg border space-y-3">
                                                    <p className="font-medium">{q.prompt || q.text || `Entrada ${i + 1}`}</p>
                                                    {imageSrc && <img src={imageSrc} alt={q.prompt || `Entrada ${i + 1}`} className="w-full rounded-md object-cover max-h-60" />}
                                                    <div className="space-y-1 text-sm">
                                                        <p>Respuesta esperada: <span className="text-green-600">{(q.answer || (q.blanks && q.blanks[0]) || "-")}</span></p>
                                                        <p>Tu respuesta: <span className="font-medium">{(savedAnswers && savedAnswers[i]) || "(sin respuesta)"}</span></p>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (evaluation.type === "matching") ? (
                                        // Matching review
                                        (() => {
                                            const data: any = evaluation.questions || { pairs: [] }
                                            const pairs: any[] = Array.isArray(data) ? (data as any[]) : (data && data.pairs) ? data.pairs as any[] : []
                                            return pairs.map((p: any) => {
                                                const leftId = p.id || p.leftId
                                                const leftText = p.left || p.leftText || p.left_label || ""
                                                const correctRightText = p.right || p.rightText || p.right_label || ""
                                                const selectedRightId = savedAnswers ? savedAnswers[leftId] : null
                                                const selectedRight = pairs.find((x: any) => (x.id || x.rightId) === selectedRightId)
                                                const selectedRightText = selectedRight ? (selectedRight.right || selectedRight.rightText || selectedRight.right_label) : "(no seleccionado)"
                                                const isCorrect = selectedRightId && (selectedRightId === (p.rightId || p.id || p.rightId))
                                                return (
                                                    <div key={leftId} className={`p-4 rounded-lg border ${isCorrect ? "border-green-200 bg-green-50" : "border-destructive/50 bg-destructive/5"}`}>
                                                        <p className="font-medium mb-2">{leftText}</p>
                                                        <p className="text-sm">Tu emparejamiento: <span className={isCorrect ? "text-green-600" : "text-destructive"}>{selectedRightText}</span></p>
                                                        {!isCorrect && <p className="text-sm">Correcto: <span className="text-green-600">{correctRightText}</span></p>}
                                                    </div>
                                                )
                                            })
                                        })()
                                    ) : (
                                        // Generic fallback: show raw answers
                                        <pre className="p-2 bg-muted/10 rounded text-sm">{JSON.stringify(savedAnswers || {}, null, 2)}</pre>
                                    )}
                                </div>

                                <Button onClick={() => router.back()} className="w-full">
                                    Volver
                                </Button>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
