"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Plus, Trash2 } from "lucide-react"

interface Question {
  id: string
  text: string
  options: string[]
  correct: number
  imageUrl?: string
  lsnVideoUrl?: string
}

interface CreateEvaluationDialogProps {
  classId: string
  activityId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEvaluationCreated: (newEvaluation: any) => void
}

export function CreateEvaluationDialog({
  classId,
  activityId,
  open,
  onOpenChange,
  onEvaluationCreated,
}: CreateEvaluationDialogProps) {
  const [title, setTitle] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  // Type-specific state
  const [matchingPairs, setMatchingPairs] = useState<{ id: string; left: string; right: string }[]>([])
  const [fillBlanks, setFillBlanks] = useState<{ id: string; prompt: string; answer: string }[]>([])
  const [dragItems, setDragItems] = useState<{ id: string; label: string }[]>([])
  const [dragTargets, setDragTargets] = useState<{ id: string; label: string }[]>([])
  const [dragMapping, setDragMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null)
  const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(null)
  const [activities, setActivities] = useState<{ id: string; label: string; type?: string }[]>([])
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null)
  const [evaluationType, setEvaluationType] = useState<string>("quiz")
  const [startAt, setStartAt] = useState<string | null>(null)
  const [dueAt, setDueAt] = useState<string | null>(null)
  const [attemptsAllowed, setAttemptsAllowed] = useState<number>(1)
  const router = useRouter()

  const addQuestion = () => {
    setEditingQuestion({
      id: Date.now().toString(),
      text: "",
      options: ["", "", "", ""],
      correct: 0,
    })
  }

  const addMatchingPair = () => {
    setMatchingPairs([...matchingPairs, { id: Date.now().toString(), left: "", right: "" }])
  }

  const deleteMatchingPair = (id: string) => {
    setMatchingPairs(matchingPairs.filter((p) => p.id !== id))
  }

  const addFillBlank = () => {
    setFillBlanks([...fillBlanks, { id: Date.now().toString(), prompt: "", answer: "" }])
  }

  const deleteFillBlank = (id: string) => {
    setFillBlanks(fillBlanks.filter((b) => b.id !== id))
  }

  const addDragItem = () => {
    setDragItems([...dragItems, { id: Date.now().toString(), label: "" }])
  }

  const deleteDragItem = (id: string) => {
    setDragItems(dragItems.filter((d) => d.id !== id))
    const m = { ...dragMapping }
    delete m[id]
    setDragMapping(m)
  }

  const addDragTarget = () => {
    setDragTargets([...dragTargets, { id: Date.now().toString(), label: "" }])
  }

  const deleteDragTarget = (id: string) => {
    setDragTargets(dragTargets.filter((t) => t.id !== id))
    // remove any mapping that points to this target
    const m = { ...dragMapping }
    Object.keys(m).forEach((k) => {
      if (m[k] === id) delete m[k]
    })
    setDragMapping(m)
  }

  const saveQuestion = (question: Partial<Question>) => {
    if (!question.text || question.options?.some((o) => !o)) {
      setError("Por favor completa todos los campos de la pregunta")
      return
    }

    if (questions.find((q) => q.id === question.id)) {
      setQuestions(questions.map((q) => (q.id === question.id ? (question as Question) : q)))
    } else {
      setQuestions([...questions, question as Question])
    }
    setEditingQuestion(null)
    setError("")
  }

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!title.trim()) {
        setError("El título de la evaluación es requerido")
        setLoading(false)
        return
      }

      // Validate depending on type
      if (evaluationType === "quiz" && questions.length === 0) {
        setError("Debe haber al menos una pregunta para un cuestionario")
        setLoading(false)
        return
      }
      if (evaluationType === "matching" && matchingPairs.length === 0) {
        setError("Agrega al menos un par para el matching")
        setLoading(false)
        return
      }
      if (evaluationType === "fill_blank" && fillBlanks.length === 0) {
        setError("Agrega al menos una entrada para fill-in-the-blank")
        setLoading(false)
        return
      }
      if (evaluationType === "dragdrop" && (dragItems.length === 0 || dragTargets.length === 0)) {
        setError("Agrega al menos un ítem y un objetivo para Drag & Drop")
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()

      // Determine activity_id to attach the evaluation to. Prefer explicit selection > prop > resolved.
      const finalActivityId = selectedActivityId || activityId || resolvedActivityId
      if (!finalActivityId) {
        setError("No se encontró ninguna actividad asociada a esta clase. Crea una actividad antes de crear evaluaciones.")
        setLoading(false)
        return
      }

      // Build questions payload according to evaluationType
      let questionsPayload: any = []
      if (evaluationType === "quiz") {
        questionsPayload = questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correct: q.correct,
          imageUrl: q.imageUrl,
          lsnVideoUrl: q.lsnVideoUrl,
        }))
      } else if (evaluationType === "matching") {
        // store as an object with pairs field
        questionsPayload = { pairs: matchingPairs.map((p) => ({ id: p.id, left: p.left, right: p.right })) }
      } else if (evaluationType === "dragdrop") {
        questionsPayload = {
          dragdrop: {
            items: dragItems.map((d) => ({ id: d.id, label: d.label })),
            targets: dragTargets.map((t) => ({ id: t.id, label: t.label })),
            mapping: dragMapping,
          },
        }
      } else if (evaluationType === "fill_blank") {
        questionsPayload = fillBlanks.map((b) => ({ id: b.id, prompt: b.prompt, answer: b.answer }))
      } else {
        // other types: keep empty or store custom structure later
        questionsPayload = []
      }

      const insertObj: any = {
        activity_id: finalActivityId,
        title: title.trim(),
        type: evaluationType,
        questions: questionsPayload,
      }

      // Attach scheduling and attempts if provided
      if (startAt) insertObj.start_at = new Date(startAt).toISOString()
      if (dueAt) insertObj.due_at = new Date(dueAt).toISOString()
      if (attemptsAllowed) insertObj.attempts_allowed = attemptsAllowed

      const { data, error: supabaseError } = await supabase.from("evaluations").insert([insertObj]).select()

      if (supabaseError) throw supabaseError

      onEvaluationCreated(data[0])
      setTitle("")
      setQuestions([])
      setMatchingPairs([])
      setFillBlanks([])
      setDragItems([])
      setDragTargets([])
      setDragMapping({})
      setStartAt(null)
      setDueAt(null)
      setAttemptsAllowed(1)
      onOpenChange(false)
    } catch (error: any) {
      setError(error.message || "Error al crear la evaluación")
    } finally {
      setLoading(false)
    }
  }

  // Try to resolve an activity id for the given class when no activityId prop is passed.
  // This allows creating an evaluation from the class page even if the caller doesn't
  // provide a specific activity: we attach it to the first activity found.
  // fetch first activity for class when dialog opens
  useEffect(() => {
    let mounted = true
    const resolveActivity = async () => {
      try {
        // if we already resolved one, skip
        if (resolvedActivityId) return
        const supabase = getSupabaseClient()
        // get lessons for class (id + title)
        const lessonsResp = await supabase.from("lessons").select("id, title").eq("class_id", classId)
        if (lessonsResp.error) return
        const lessonIds = lessonsResp.data?.map((l: any) => l.id) || []
        if (lessonIds.length === 0) return
        const activitiesResp = await supabase
          .from("activities")
          .select("id, lesson_id, title, type")
          .in("lesson_id", lessonIds)
        if (activitiesResp.error) return

        // build labels using lesson title when possible
        const lessonsById: Record<string, string> = {}
          ; (lessonsResp.data || []).forEach((l: any) => {
            lessonsById[l.id] = l.title || "Lección"
          })

        const mapped = (activitiesResp.data || []).map((a: any) => ({
          id: a.id,
          label: `${lessonsById[a.lesson_id] || "Lección"} — ${a.title || "Actividad"}`,
          type: a.type || null,
        }))

        const aid = mapped.length > 0 ? mapped[0].id : null
        if (mounted) {
          setResolvedActivityId(aid)
          setActivities(mapped)

          // If caller passed an explicit activityId prop, prefer that and default the evaluation type from it
          if (activityId) {
            const foundByProp = mapped.find((m: any) => m.id === activityId)
            if (foundByProp) {
              setSelectedActivityId(activityId)
              setSelectedActivityType(foundByProp.type || null)
              setEvaluationType(foundByProp.type || "quiz")
            } else {
              // fallback to resolved aid
              if (aid) {
                setSelectedActivityId(aid)
                const found = mapped.find((m: any) => m.id === aid)
                if (found) {
                  setSelectedActivityType(found.type || null)
                  setEvaluationType(found.type || "quiz")
                }
              }
            }
          } else {
            if (aid) {
              setSelectedActivityId(aid)
              const found = mapped.find((m: any) => m.id === aid)
              if (found) {
                setSelectedActivityType(found.type || null)
                setEvaluationType(found.type || "quiz")
              }
            }
          }
        }
      } catch (e) {
        // ignore - this is just a best-effort resolution
      }
    }

    if (open) resolveActivity()
    return () => {
      mounted = false
    }
  }, [open, classId, resolvedActivityId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Evaluación</DialogTitle>
          <DialogDescription>Crea un cuestionario accesible para tus estudiantes</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity selector: choose which activity the evaluation will attach to */}
          <div>
            <label className="block text-sm font-medium mb-1">Actividad asociada</label>
            {activities.length > 0 ? (
              <select
                value={selectedActivityId || ""}
                onChange={(e) => {
                  const val = e.target.value || null
                  setSelectedActivityId(val)
                  const found = activities.find((a) => a.id === val)
                  if (found) {
                    setSelectedActivityType(found.type || null)
                    setEvaluationType(found.type || "quiz")
                  } else {
                    setSelectedActivityType(null)
                    setEvaluationType("quiz")
                  }
                }}
                className="w-full px-3 py-2 border rounded bg-background"
                disabled={loading}
              >
                <option value="">-- Seleccionar actividad --</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">No hay actividades en esta clase.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dashboard/classes/${classId}/activities`)}
                >
                  Ir a Actividades
                </Button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Título de la Evaluación
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Evaluación de Comprensión Lectora"
              disabled={loading || editingQuestion !== null}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo de evaluación</label>
            <select
              value={evaluationType}
              onChange={(e) => setEvaluationType(e.target.value)}
              className="w-full px-3 py-2 border rounded bg-background"
              disabled={loading}
            >
              <option value="quiz">Cuestionario</option>
              <option value="fill_blank">Fill-in-the-Blank</option>
              <option value="matching">Matching</option>
              <option value="dragdrop">Drag & Drop</option>
              <option value="coding">Coding</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Se selecciona por defecto según la actividad asociada.</p>
          </div>

          {/* Scheduling and attempts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Inicio (fecha y hora)</label>
              <input
                type="datetime-local"
                value={startAt || ""}
                onChange={(e) => setStartAt(e.target.value || null)}
                className="w-full px-3 py-2 border rounded bg-background"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimiento (fecha y hora)</label>
              <input
                type="datetime-local"
                value={dueAt || ""}
                onChange={(e) => setDueAt(e.target.value || null)}
                className="w-full px-3 py-2 border rounded bg-background"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Intentos permitidos</label>
              <input
                type="number"
                min={1}
                value={attemptsAllowed}
                onChange={(e) => setAttemptsAllowed(Math.max(1, Number.parseInt(e.target.value || '1')))}
                className="w-full px-3 py-2 border rounded bg-background"
                disabled={loading}
              />
            </div>
          </div>

          {/* Type-specific editors */}
          {evaluationType === "quiz" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Preguntas ({questions.length})</label>
                <Button type="button" size="sm" onClick={addQuestion} disabled={loading || editingQuestion !== null}>
                  <Plus className="w-4 h-4" />
                  Agregar Pregunta
                </Button>
              </div>

              {questions.map((question, index) => (
                <div key={question.id} className="p-3 border rounded-lg mb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {index + 1}. {question.text}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {question.options.map((option, optIndex) => (
                          <li key={optIndex} className="text-sm">
                            <span className={optIndex === question.correct ? "text-green-600 font-medium" : ""}>
                              {String.fromCharCode(65 + optIndex)}) {option}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteQuestion(question.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {evaluationType === "matching" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Pares para Matching ({matchingPairs.length})</label>
                <Button type="button" size="sm" onClick={addMatchingPair} disabled={loading}>
                  <Plus className="w-4 h-4" />
                  Agregar Par
                </Button>
              </div>
              {matchingPairs.map((p, idx) => (
                <div key={p.id} className="p-3 border rounded-lg mb-2">
                  <div className="flex gap-2 items-center">
                    <Input value={p.left} onChange={(e) => setMatchingPairs(matchingPairs.map(m => m.id === p.id ? { ...m, left: e.target.value } : m))} placeholder={`Elemento A ${idx + 1}`} />
                    <Input value={p.right} onChange={(e) => setMatchingPairs(matchingPairs.map(m => m.id === p.id ? { ...m, right: e.target.value } : m))} placeholder={`Elemento B ${idx + 1}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteMatchingPair(p.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {evaluationType === "fill_blank" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Entradas para Fill-in-the-Blank ({fillBlanks.length})</label>
                <Button type="button" size="sm" onClick={addFillBlank} disabled={loading}>
                  <Plus className="w-4 h-4" />
                  Agregar Entrada
                </Button>
              </div>
              {fillBlanks.map((b, idx) => (
                <div key={b.id} className="p-3 border rounded-lg mb-2">
                  <div className="flex gap-2 items-center">
                    <Input value={b.prompt} onChange={(e) => setFillBlanks(fillBlanks.map(f => f.id === b.id ? { ...f, prompt: e.target.value } : f))} placeholder={`Prompt ${idx + 1}`} />
                    <Input value={b.answer} onChange={(e) => setFillBlanks(fillBlanks.map(f => f.id === b.id ? { ...f, answer: e.target.value } : f))} placeholder={`Respuesta esperada ${idx + 1}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteFillBlank(b.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {evaluationType === "dragdrop" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Ítems (arrastrables) ({dragItems.length})</label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={addDragItem} disabled={loading}>
                    <Plus className="w-4 h-4" />
                    Agregar Ítem
                  </Button>
                  <Button type="button" size="sm" onClick={addDragTarget} disabled={loading}>
                    <Plus className="w-4 h-4" />
                    Agregar Objetivo
                  </Button>
                </div>
              </div>

              {/* Items list */}
              {dragItems.map((it, idx) => (
                <div key={it.id} className="p-3 border rounded-lg mb-2">
                  <div className="flex gap-2 items-center">
                    <Input value={it.label} onChange={(e) => setDragItems(dragItems.map(d => d.id === it.id ? { ...d, label: e.target.value } : d))} placeholder={`Ítem ${idx + 1}`} />
                    <select
                      value={dragMapping[it.id] || ""}
                      onChange={(e) => setDragMapping({ ...dragMapping, [it.id]: e.target.value })}
                      className="px-2 py-1 border rounded bg-background"
                    >
                      <option value="">-- Asignar objetivo --</option>
                      {dragTargets.map(t => (
                        <option key={t.id} value={t.id}>{t.label || t.id}</option>
                      ))}
                    </select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteDragItem(it.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Targets list */}
              <div className="mt-2">
                <label className="block text-sm font-medium mb-2">Objetivos ({dragTargets.length})</label>
                {dragTargets.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2 mb-2">
                    <Input value={t.label} onChange={(e) => setDragTargets(dragTargets.map(dt => dt.id === t.id ? { ...dt, label: e.target.value } : dt))} placeholder={`Objetivo ${idx + 1}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteDragTarget(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Editor */}
          {editingQuestion && (
            <div className="p-4 border border-primary rounded-lg bg-primary/5 space-y-4">
              <h3 className="font-medium">Editar Pregunta</h3>
              <Textarea
                value={editingQuestion.text || ""}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                placeholder="Escribe la pregunta..."
                rows={2}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium">Opciones de Respuesta</label>
                {editingQuestion.options?.map((option, i) => (
                  <Input
                    key={i}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(editingQuestion.options || [])]
                      newOptions[i] = e.target.value
                      setEditingQuestion({ ...editingQuestion, options: newOptions })
                    }}
                    placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                  />
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Respuesta Correcta</label>
                <select
                  value={editingQuestion.correct || 0}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correct: Number.parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  {editingQuestion.options?.map((_, i) => (
                    <option key={i} value={i}>
                      {String.fromCharCode(65 + i)} - {editingQuestion.options?.[i]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditingQuestion(null)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => saveQuestion(editingQuestion)}>
                  Guardar Pregunta
                </Button>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || editingQuestion !== null}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || editingQuestion !== null}>
              {loading ? "Creando..." : "Crear Evaluación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
