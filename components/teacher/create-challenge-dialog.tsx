"use client"

import { useState } from "react"
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
    const [startAt, setStartAt] = useState<string | null>(null)
    const [dueAt, setDueAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const previewPayload = () => {
        if (type === "multiple_choice") {
            return { prompt: mcQuestion, options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex }
        }
        if (type === "fill_blank") return { prompt: fillPrompt }
        if (type === "select_image") return { options: selectImageOptions.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })) }
        if (type === "matching") return { pairs: matchingPairs.map((p) => ({ id: p.id, left: p.left, right: p.right })) }
        if (type === "open_ended") return { prompt: openPrompt }
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
            return { prompt: mcQuestion.trim(), options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex }
        }

        if (type === "fill_blank") {
            if (!fillPrompt || !fillPrompt.trim()) throw new Error("El enunciado del Fill Blank no puede estar vacío")
            // optional: enforce placeholder
            return { prompt: fillPrompt }
        }

        if (type === "select_image") {
            if (selectImageOptions.length < 2) throw new Error("Agrega al menos 2 opciones con imagen")
            if (selectImageOptions.some((o) => !o.label.trim() || !o.imageUrl.trim())) throw new Error("Cada opción debe tener etiqueta y URL de imagen")
            return { options: selectImageOptions.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })) }
        }

        if (type === "matching") {
            if (matchingPairs.length < 1) throw new Error("Agrega al menos un par para Matching")
            if (matchingPairs.some((p) => !p.left.trim() || !p.right.trim())) throw new Error("Todos los pares deben tener ambos lados rellenos")
            return { pairs: matchingPairs.map((p) => ({ id: p.id, left: p.left, right: p.right })) }
        }

        if (type === "open_ended") {
            if (!openPrompt.trim()) throw new Error("El enunciado no puede estar vacío")
            return { prompt: openPrompt }
        }

        return {}
    }

    const handleCreate = async () => {
        setLoading(true)
        setError(null)
        try {
            const supabase = getSupabaseClient()
            const payloadJson = validateAndBuildPayload()

            const toInsert = {
                class_id: classId,
                teacher_id: (await supabase.auth.getUser()).data.user?.id,
                title: title.trim(),
                description: description.trim(),
                type,
                payload: payloadJson,
                start_at: startAt ? new Date(startAt).toISOString() : null,
                due_at: dueAt ? new Date(dueAt).toISOString() : null,
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear Desafío</DialogTitle>
                </DialogHeader>

                <div className="grid gap-2">
                    <label className="text-sm">Título</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />

                    <label className="text-sm">Descripción</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />

                    <label className="text-sm">Tipo</label>
                    <Select onValueChange={(v) => setType(v)} defaultValue={type}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            <SelectItem value="fill_blank">Fill Blank</SelectItem>
                            <SelectItem value="select_image">Select Image</SelectItem>
                            <SelectItem value="matching">Matching</SelectItem>
                            <SelectItem value="open_ended">Open Ended</SelectItem>
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
