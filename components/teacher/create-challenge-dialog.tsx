"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSupabaseClient } from "@/lib/supabase/client"

interface Props {
    classId: string
    onChallengeCreated?: (challenge: any) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export default function CreateChallengeDialog({ classId, onChallengeCreated, open, onOpenChange }: Props) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState("multiple_choice")
    // structured state for different challenge types
    const [payload, setPayload] = useState<any>(null)
    const [mcOptions, setMcOptions] = useState<Array<{ id: string; text: string }>>([
        { id: "opt-1", text: "" },
    ])
    const [mcCorrectIndex, setMcCorrectIndex] = useState<number>(0)
    const [mcQuestion, setMcQuestion] = useState("")

    const [fillPrompt, setFillPrompt] = useState("")

    const [selectImageOptions, setSelectImageOptions] = useState<Array<{ id: string; label: string; imageUrl: string }>>([
        { id: "img-1", label: "", imageUrl: "" },
    ])

    const [matchingPairs, setMatchingPairs] = useState<Array<{ id: string; left: string; right: string }>>([
        { id: "pair-1", left: "", right: "" },
    ])

    const [openPrompt, setOpenPrompt] = useState("")

    // Sign practice specific state
    const [signPrompt, setSignPrompt] = useState("")
    const [signTips, setSignTips] = useState("")
    const [signReferenceTranscript, setSignReferenceTranscript] = useState("")
    const [signReferenceDuration, setSignReferenceDuration] = useState("")
    const [signReferenceVideoFile, setSignReferenceVideoFile] = useState<File | null>(null)
    const [signMaxScore, setSignMaxScore] = useState("100")
    const [rubricCriteria, setRubricCriteria] = useState<Array<{ id: string; label: string; weight: number; description: string }>>([
        { id: "crit-claridad", label: "Claridad", weight: 40, description: "Señales legibles y consistentes." },
        { id: "crit-expresividad", label: "Expresividad", weight: 30, description: "Uso de expresiones faciales y corporales apropiadas." },
        { id: "crit-precision", label: "Precisión", weight: 30, description: "Configuración correcta de manos y trayectoria." },
    ])
    const [startAt, setStartAt] = useState<string | null>(null)
    const [dueAt, setDueAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sanitizeFilename = (name: string) => {
        return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
    }

    const totalRubricWeight = useMemo(() => rubricCriteria.reduce((acc, crit) => acc + (Number(crit.weight) || 0), 0), [rubricCriteria])

    const previewPayload = () => {
        if (type === "multiple_choice") {
            return { prompt: mcQuestion, options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex }
        }
        if (type === "fill_blank") return { prompt: fillPrompt }
        if (type === "select_image") return { options: selectImageOptions.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })) }
        if (type === "matching") return { pairs: matchingPairs.map((p) => ({ id: p.id, left: p.left, right: p.right })) }
        if (type === "open_ended") return { prompt: openPrompt }
        if (type === "sign_practice") {
            return {
                prompt: signPrompt,
                tips: signTips,
                rubric: rubricCriteria,
                reference_video: signReferenceVideoFile?.name || "Sin video",
            }
        }
        return {}
    }

    const validateAndBuildPayload = () => {
        // returns payload or throws Error with user-friendly message
        if (!title.trim()) throw new Error("El título es obligatorio")

        if (type === "multiple_choice") {
            if (mcOptions.length < 2) throw new Error("Agrega al menos 2 opciones para Multiple Choice")
            if (mcOptions.some((o) => !o.text || !o.text.trim())) throw new Error("Todas las opciones deben tener texto")
            if (mcCorrectIndex < 0 || mcCorrectIndex >= mcOptions.length) throw new Error("Selecciona la opción correcta")
            if (!mcQuestion.trim()) throw new Error("Escribe la pregunta para el Multiple Choice")
            return { payload: { prompt: mcQuestion.trim(), options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex } }
        }

        if (type === "fill_blank") {
            if (!fillPrompt || !fillPrompt.trim()) throw new Error("El enunciado del Fill Blank no puede estar vacío")
            // optional: enforce placeholder
            return { payload: { prompt: fillPrompt } }
        }

        if (type === "select_image") {
            if (selectImageOptions.length < 2) throw new Error("Agrega al menos 2 opciones con imagen")
            if (selectImageOptions.some((o) => !o.label.trim() || !o.imageUrl.trim())) throw new Error("Cada opción debe tener etiqueta y URL de imagen")
            return { payload: { options: selectImageOptions.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })) } }
        }

        if (type === "matching") {
            if (matchingPairs.length < 1) throw new Error("Agrega al menos un par para Matching")
            if (matchingPairs.some((p) => !p.left.trim() || !p.right.trim())) throw new Error("Todos los pares deben tener ambos lados rellenos")
            return { payload: { pairs: matchingPairs.map((p) => ({ id: p.id, left: p.left, right: p.right })) } }
        }

        if (type === "open_ended") {
            if (!openPrompt.trim()) throw new Error("El enunciado no puede estar vacío")
            return { payload: { prompt: openPrompt } }
        }

        if (type === "sign_practice") {
            if (!signPrompt.trim()) throw new Error("Describe el reto de seña para el estudiante")
            const normalizedRubric = rubricCriteria
                .map((crit) => ({
                    id: crit.id,
                    label: crit.label.trim(),
                    weight: Number(crit.weight) || 0,
                    description: crit.description.trim(),
                }))
                .filter((crit) => crit.label && crit.weight > 0)
            if (normalizedRubric.length === 0) throw new Error("Agrega al menos un criterio de rúbrica con peso mayor a 0")
            const parsedMaxScore = Number(signMaxScore)
            if (Number.isNaN(parsedMaxScore) || parsedMaxScore <= 0) throw new Error("Ingresa una puntuación máxima válida")
            let referenceVideoDurationSeconds: number | null = null
            if (signReferenceDuration.trim()) {
                const parsed = Number(signReferenceDuration)
                if (Number.isNaN(parsed) || parsed < 0) throw new Error("La duración estimada debe ser un número positivo")
                referenceVideoDurationSeconds = Math.round(parsed)
            }
            const payload = {
                prompt: signPrompt.trim(),
                tips: signTips.trim(),
                reference_video_transcript: signReferenceTranscript.trim() || null,
            }
            return {
                payload,
                rubric: normalizedRubric,
                maxScore: parsedMaxScore,
                referenceVideoFile: signReferenceVideoFile,
                referenceVideoDurationSeconds,
                referenceVideoTranscript: signReferenceTranscript.trim() || null,
            }
        }

        return { payload: {} }
    }

    const handleCreate = async () => {
        setLoading(true)
        setError(null)
        try {
            const supabase = getSupabaseClient()
            const built = validateAndBuildPayload()
            let payloadJson = built.payload
            let rubricJson = built.rubric
            let maxScoreValue = built.maxScore
            let referenceVideoDurationSeconds = built.referenceVideoDurationSeconds
            let referenceVideoTranscript = built.referenceVideoTranscript
            let referenceVideoStoragePath: string | null = null

            if (type === "sign_practice" && built.referenceVideoFile) {
                const file = built.referenceVideoFile
                const extension = file.name.split(".").pop()?.toLowerCase() || "mp4"
                const rawBase = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
                const safeBase = sanitizeFilename(rawBase)
                const objectPath = `challenges/${classId}/${safeBase}-${Date.now()}.${extension}`
                const uploadResp = await supabase.storage.from("library").upload(objectPath, file, {
                    upsert: true,
                    contentType: file.type || "video/mp4",
                })
                if (uploadResp.error) throw uploadResp.error
                referenceVideoStoragePath = objectPath
                payloadJson = {
                    ...payloadJson,
                    reference_video_storage_path: objectPath,
                }
            }

            const toInsert = {
                class_id: classId,
                teacher_id: (await supabase.auth.getUser()).data.user?.id,
                title: title.trim(),
                description: description.trim(),
                type,
                payload: payloadJson,
                start_at: startAt ? new Date(startAt).toISOString() : null,
                due_at: dueAt ? new Date(dueAt).toISOString() : null,
                rubric: rubricJson || null,
                max_score: typeof maxScoreValue === "number" ? maxScoreValue : null,
                reference_video_storage_path: referenceVideoStoragePath,
                reference_video_duration_seconds: referenceVideoDurationSeconds ?? null,
                reference_video_transcript: referenceVideoTranscript || null,
            }

            const resp = await supabase.from("challenges").insert([toInsert]).select().single()
            if (resp.error) throw resp.error
            onChallengeCreated && onChallengeCreated(resp.data)
            // reset form
            setTitle("")
            setDescription("")
            setType("multiple_choice")
            setPayload(null)
            setMcOptions([{ id: "opt-1", text: "" }])
            setMcCorrectIndex(0)
            setFillPrompt("")
            setSelectImageOptions([{ id: "img-1", label: "", imageUrl: "" }])
            setMatchingPairs([{ id: "pair-1", left: "", right: "" }])
            setOpenPrompt("")
            setSignPrompt("")
            setSignTips("")
            setSignReferenceTranscript("")
            setSignReferenceDuration("")
            setSignReferenceVideoFile(null)
            setSignMaxScore("100")
            setRubricCriteria([
                { id: "crit-claridad", label: "Claridad", weight: 40, description: "Señales legibles y consistentes." },
                { id: "crit-expresividad", label: "Expresividad", weight: 30, description: "Uso de expresiones faciales y corporales apropiadas." },
                { id: "crit-precision", label: "Precisión", weight: 30, description: "Configuración correcta de manos y trayectoria." },
            ])
            setStartAt(null)
            setDueAt(null)
            onOpenChange && onOpenChange(false)
        } catch (err) {
            console.error("Error creating challenge:", err)
            const msg = (err as any)?.message || "Error creando el desafío"
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    Crear Desafío
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Crear Desafío</DialogTitle>
                </DialogHeader>

                <div className="grid gap-2">
                    <label className="text-sm">Título</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />

                    <label className="text-sm">Descripción</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />

                    <label className="text-sm">Tipo</label>
                    <Select onValueChange={(v) => setType(v)} value={type}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            <SelectItem value="fill_blank">Fill Blank</SelectItem>
                            <SelectItem value="select_image">Select Image</SelectItem>
                            <SelectItem value="matching">Matching</SelectItem>
                            <SelectItem value="open_ended">Open Ended</SelectItem>
                            <SelectItem value="sign_practice">Práctica de señas (video)</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Type-specific forms */}
                    {type === "multiple_choice" && (
                        <div className="space-y-2">
                            <label className="text-sm">Pregunta</label>
                            <Input value={mcQuestion} onChange={(e) => setMcQuestion(e.target.value)} placeholder="Escribe la pregunta que verán los estudiantes" />

                            <p className="text-sm">Opciones (marca la correcta)</p>
                            {mcOptions.map((opt, idx) => (
                                <div key={opt.id} className="flex gap-2 items-center">
                                    <div className="w-6 text-sm font-medium">{String.fromCharCode(65 + idx)})</div>
                                    <Input value={opt.text} onChange={(e) => setMcOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, text: e.target.value } : p)))} />
                                    <Button title="Marcar como correcta" variant={mcCorrectIndex === idx ? "default" : "outline"} onClick={() => setMcCorrectIndex(idx)}>
                                        Correcta
                                    </Button>
                                    <Button variant="ghost" onClick={() => setMcOptions((prev) => prev.filter((_, i) => i !== idx))}>
                                        Eliminar
                                    </Button>
                                </div>
                            ))}
                            <Button onClick={() => setMcOptions((prev) => [...prev, { id: `opt-${Date.now()}`, text: "" }])}>Añadir opción</Button>
                        </div>
                    )}

                    {type === "fill_blank" && (
                        <div>
                            <label className="text-sm">Enunciado (usa ___ para indicar el hueco)</label>
                            <Textarea value={fillPrompt} onChange={(e) => setFillPrompt(e.target.value)} />
                        </div>
                    )}

                    {type === "select_image" && (
                        <div className="space-y-2">
                            <p className="text-sm">Opciones con imagen</p>
                            {selectImageOptions.map((opt, idx) => (
                                <div key={opt.id} className="grid grid-cols-3 gap-2 items-center">
                                    <Input placeholder="Etiqueta" value={opt.label} onChange={(e) => setSelectImageOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))} />
                                    <Input placeholder="URL de imagen" value={opt.imageUrl} onChange={(e) => setSelectImageOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: e.target.value } : p)))} />
                                    <Button variant="ghost" onClick={() => setSelectImageOptions((prev) => prev.filter((_, i) => i !== idx))}>Eliminar</Button>
                                </div>
                            ))}
                            <Button onClick={() => setSelectImageOptions((prev) => [...prev, { id: `img-${Date.now()}`, label: "", imageUrl: "" }])}>Añadir opción</Button>
                        </div>
                    )}

                    {type === "matching" && (
                        <div className="space-y-2">
                            <p className="text-sm">Pares para emparejar</p>
                            {matchingPairs.map((p, idx) => (
                                <div key={p.id} className="flex gap-2">
                                    <Input placeholder="Izquierda" value={p.left} onChange={(e) => setMatchingPairs((prev) => prev.map((q, i) => (i === idx ? { ...q, left: e.target.value } : q)))} />
                                    <Input placeholder="Derecha" value={p.right} onChange={(e) => setMatchingPairs((prev) => prev.map((q, i) => (i === idx ? { ...q, right: e.target.value } : q)))} />
                                    <Button variant="ghost" onClick={() => setMatchingPairs((prev) => prev.filter((_, i) => i !== idx))}>Eliminar</Button>
                                </div>
                            ))}
                            <Button onClick={() => setMatchingPairs((prev) => [...prev, { id: `pair-${Date.now()}`, left: "", right: "" }])}>Añadir par</Button>
                        </div>
                    )}

                    {type === "open_ended" && (
                        <div>
                            <label className="text-sm">Enunciado</label>
                            <Textarea value={openPrompt} onChange={(e) => setOpenPrompt(e.target.value)} />
                        </div>
                    )}

                    {type === "sign_practice" && (
                        <div className="space-y-3 border rounded-md p-3">
                            <div>
                                <label className="text-sm font-medium">Instrucciones del reto</label>
                                <Textarea value={signPrompt} onChange={(e) => setSignPrompt(e.target.value)} placeholder="Describe lo que el estudiante debe grabar en LSN" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Tips opcionales</label>
                                <Textarea value={signTips} onChange={(e) => setSignTips(e.target.value)} placeholder="Ej. Recuerda vocalizar, usa expresiones, etc." />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Video de referencia (opcional)</label>
                                <Input type="file" accept="video/*" onChange={(e) => setSignReferenceVideoFile(e.target.files?.[0] || null)} />
                                {signReferenceVideoFile && <p className="text-xs text-muted-foreground mt-1">Archivo seleccionado: {signReferenceVideoFile.name}</p>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Duración estimada (segundos)</label>
                                    <Input type="number" min="0" value={signReferenceDuration} onChange={(e) => setSignReferenceDuration(e.target.value)} placeholder="Ej. 30" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Puntaje máximo</label>
                                    <Input type="number" min="1" value={signMaxScore} onChange={(e) => setSignMaxScore(e.target.value)} placeholder="100" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Transcripción / Glosa del video</label>
                                <Textarea value={signReferenceTranscript} onChange={(e) => setSignReferenceTranscript(e.target.value)} placeholder="Describe la seña referencia para estudiantes con baja conectividad" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Rúbrica (peso total {totalRubricWeight})</label>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setRubricCriteria((prev) => [...prev, { id: `crit-${Date.now()}`, label: "Nuevo criterio", weight: 10, description: "" }])}>
                                        Añadir criterio
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {rubricCriteria.map((crit, idx) => (
                                        <div key={crit.id} className="border rounded-md p-2 space-y-2">
                                            <div className="flex flex-col md:flex-row gap-2">
                                                <Input
                                                    placeholder="Nombre del criterio"
                                                    value={crit.label}
                                                    onChange={(e) => setRubricCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)))}
                                                />
                                                <Input
                                                    type="number"
                                                    className="md:w-32"
                                                    min="0"
                                                    value={crit.weight}
                                                    onChange={(e) => setRubricCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, weight: Number(e.target.value) } : c)))}
                                                    placeholder="Peso"
                                                />
                                            </div>
                                            <Textarea
                                                placeholder="Detalle de evaluación"
                                                value={crit.description}
                                                onChange={(e) => setRubricCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, description: e.target.value } : c)))}
                                            />
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setRubricCriteria((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
                                                    }
                                                    disabled={rubricCriteria.length === 1}
                                                >
                                                    Eliminar
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Asegúrate de que la suma de pesos cubra el total esperado (sugerido 100).</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-sm">Inicio</label>
                            <Input type="datetime-local" value={startAt ?? ""} onChange={(e) => setStartAt(e.target.value || null)} />
                        </div>
                        <div>
                            <label className="text-sm">Vence</label>
                            <Input type="datetime-local" value={dueAt ?? ""} onChange={(e) => setDueAt(e.target.value || null)} />
                        </div>
                    </div>

                    {/* Vista previa amigable para el profesor (no mostrar JSON) */}
                    <div>
                        <label className="text-sm">Vista previa</label>
                        <div className="p-3 border rounded">
                            {type === "multiple_choice" && (
                                <div>
                                    <p className="font-medium mb-2">{mcQuestion || "(Pregunta sin escribir)"}</p>
                                    <ul className="space-y-1">
                                        {mcOptions.map((o, i) => (
                                            <li key={o.id} className={`flex items-center gap-2 ${mcCorrectIndex === i ? "bg-green-50 p-2 rounded" : ""}`}>
                                                <span className="w-6 font-medium">{String.fromCharCode(65 + i)})</span>
                                                <span>{o.text || "(opción vacía)"}</span>
                                                {mcCorrectIndex === i && <span className="ml-2 text-xs text-green-700">Correcta</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {type === "fill_blank" && (
                                <div>
                                    <p className="font-medium">{fillPrompt || "(Enunciado vacío)"}</p>
                                </div>
                            )}

                            {type === "select_image" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {selectImageOptions.map((opt) => (
                                        <div key={opt.id} className="flex items-center gap-2 border p-2 rounded">
                                            {opt.imageUrl ? <img src={opt.imageUrl} alt={opt.label} className="w-20 h-20 object-cover" /> : <div className="w-20 h-20 bg-muted" />}
                                            <div>
                                                <div className="font-medium">{opt.label || "(etiqueta)"}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {type === "matching" && (
                                <div>
                                    <ul className="space-y-1">
                                        {matchingPairs.map((p, idx) => (
                                            <li key={p.id} className="flex gap-4">
                                                <span className="font-medium">{p.left}</span>
                                                <span className="text-muted-foreground">—</span>
                                                <span>{p.right}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {type === "open_ended" && (
                                <div>
                                    <p className="font-medium">{openPrompt || "(Enunciado vacío)"}</p>
                                </div>
                            )}

                            {type === "sign_practice" && (
                                <div className="space-y-2">
                                    <p className="font-medium">{signPrompt || "(Describe el reto)"}</p>
                                    {signTips && <p className="text-sm text-muted-foreground">Tips: {signTips}</p>}
                                    {signReferenceVideoFile ? (
                                        <p className="text-sm">Video seleccionado: {signReferenceVideoFile.name}</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sin video de referencia adjunto.</p>
                                    )}
                                    <div>
                                        <p className="font-medium text-sm">Rúbrica</p>
                                        <ul className="text-sm list-disc pl-5">
                                            {rubricCriteria.map((crit) => (
                                                <li key={crit.id}>
                                                    {crit.label} — {crit.weight} pts
                                                    {crit.description && <span className="text-muted-foreground"> · {crit.description}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    {error && <div className="text-sm text-destructive mr-auto">{error}</div>}
                    <Button variant="ghost" onClick={() => onOpenChange && onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={loading}>
                        {loading ? "Creando..." : "Crear"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
