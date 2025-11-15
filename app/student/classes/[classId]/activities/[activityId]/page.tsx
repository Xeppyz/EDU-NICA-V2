"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { toEmbedUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

interface Question {
  text: string
  options: string[]
  correct: number
  imageUrl?: string
  lsnVideoUrl?: string
}

interface Evaluation {
  id: string
  title: string
  questions: Question[]
}

export default function ActivityPage() {
  const router = useRouter()
  const params = useParams()
  const activityId = params.activityId as string
  const classId = params.classId as string

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [lessonId, setLessonId] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvaluation() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        const supabase = getSupabaseClient()

        // Get activity and evaluation
        const { data: activityData } = await supabase.from("activities").select("id, lesson_id").eq("id", activityId).single()

        if (!activityData) throw new Error("Actividad no encontrada")
        // store lesson id so submit handler can upsert progress
        setLessonId(activityData.lesson_id)

        const { data: evaluationData } = await supabase
          .from("evaluations")
          .select("*")
          .eq("activity_id", activityId)
          .single()

        if (evaluationData) {
          setEvaluation(evaluationData)
          setAnswers(new Array(evaluationData.questions.length).fill(-1))
        }
      } catch (error) {
        console.error("Error loading evaluation:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEvaluation()
  }, [activityId, router])

  const handleSubmit = async () => {
    if (!evaluation) return

    // Calculate score
    let correctCount = 0
    evaluation.questions.forEach((q, i) => {
      if (answers[i] === q.correct) {
        correctCount++
      }
    })

    const finalScore = Math.round((correctCount / evaluation.questions.length) * 100)
    setScore(finalScore)
    setSubmitted(true)

    // Save response and mark lesson progress
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser || !evaluation) return

      const supabase = getSupabaseClient()
      const payload = [
        {
          student_id: currentUser.id,
          evaluation_id: evaluation.id,
          answers: answers,
          score: finalScore,
          completed_at: new Date().toISOString(),
        },
      ]

      console.debug("Inserting student response payload:", payload)

      const resp = await supabase.from("student_responses").insert(payload).select()

      if (resp?.error) {
        // Log full response and detail fields to surface RLS / DB errors that may appear empty
        console.error("Error saving response - full supabase response:", resp)

        // Try stringifying - sometimes non-enumerable props hide detail in console
        try {
          console.error("Stringified response:", JSON.stringify(resp, Object.getOwnPropertyNames(resp) as any))
        } catch (e) {
          console.error("Could not stringify response:", e)
        }

        try {
          const err = resp.error as any
          console.error("Supabase error details:", {
            message: err?.message ?? null,
            code: err?.code ?? null,
            details: err?.details ?? null,
            hint: err?.hint ?? null,
            status: (resp as any)?.status ?? null,
            keys: Object.getOwnPropertyNames(resp),
            errorKeys: err ? Object.getOwnPropertyNames(err) : [],
          })
        } catch (e) {
          console.error("Error serializing supabase error object:", e)
        }

        // If response is essentially empty, recommend inspecting Network tab
        if (Object.keys(resp).length === 0) {
          console.error(
            "Supabase client returned an empty object. Check browser Network tab for the POST request to your Supabase endpoint, and verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in the client. Also check for CORS, 401/403 or RLS errors in the response body.",
          )
        }
      } else {
        console.debug("Saved student_responses result:", resp.data)
        // mark lesson complete if we have lesson_id from activityData
        try {
          const lId = lessonId
          if (lId) {
            const upsertPayload = {
              student_id: currentUser.id,
              class_id: classId,
              lesson_id: lId,
              progress_percentage: 100,
              completed: true,
              last_accessed: new Date().toISOString(),
            }

            // Use onConflict so Postgres will update instead of throwing a duplicate key error
            const upsertResp = await supabase
              .from("student_progress")
              .upsert(upsertPayload, { onConflict: "student_id,class_id,lesson_id" })
              .select()

            if (upsertResp.error) {
              console.error("Error upserting progress:", upsertResp.error)
              // Fallback: if a unique-constraint race still occurs, try an update
              const code = (upsertResp.error as any)?.code
              if (code === "23505" || code === 23505) {
                try {
                  const updateResp = await supabase
                    .from("student_progress")
                    .update({
                      progress_percentage: 100,
                      completed: true,
                      last_accessed: new Date().toISOString(),
                    })
                    .eq("student_id", currentUser.id)
                    .eq("class_id", classId)
                    .eq("lesson_id", lId)
                    .select()
                  if (updateResp.error) console.error("Error updating existing progress after conflict:", updateResp.error)
                  else console.debug("Updated existing progress after conflict:", updateResp.data)
                } catch (e) {
                  console.error("Fallback update error:", e)
                }
              }
            } else {
              console.debug("Upserted progress:", upsertResp.data)
            }
          }
        } catch (e) {
          console.error("Error marking lesson progress after response:", e)
        }
      }
    } catch (error) {
      console.error("Error saving response:", error)
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

  const question = evaluation.questions[currentQuestion]
  const currentAnswer = answers[currentQuestion]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        ← Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{evaluation.title}</CardTitle>
          <CardDescription>
            Pregunta {currentQuestion + 1} de {evaluation.questions.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!submitted ? (
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
                    style={{ width: `${((currentQuestion + 1) / evaluation.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{question.text}</h3>

                  {/* Question Image */}
                  {question.imageUrl && (
                    <div className="mb-4 aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={question.imageUrl || "/placeholder.svg"}
                        alt="Pregunta"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* LSN Video */}
                  {question.lsnVideoUrl && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Interpreración en Lengua de Señas Nicaragüense
                      </p>
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                        <iframe
                          width="100%"
                          height="100%"
                          src={toEmbedUrl(question.lsnVideoUrl) || question.lsnVideoUrl}
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
                  <RadioGroup value={currentAnswer === -1 ? "" : currentAnswer.toString()}>
                    {question.options.map((option, i) => (
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
                  <Button onClick={handleSubmit} disabled={answers.includes(-1)} className="flex-1 ml-2">
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

              {/* Review Answers */}
              <div className="space-y-4">
                <h3 className="font-semibold">Revisión de Respuestas</h3>
                {evaluation.questions.map((q, i) => {
                  const isCorrect = answers[i] === q.correct
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${isCorrect ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-destructive/50 bg-destructive/5"}`}
                    >
                      <p className="font-medium mb-2">
                        Pregunta {i + 1}: {q.text}
                      </p>
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
                })}
              </div>

              <Button onClick={() => router.back()} className="w-full">
                Volver
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
