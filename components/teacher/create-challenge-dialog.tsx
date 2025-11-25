"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSupabaseClient } from "@/lib/supabase/client"
import { CHALLENGE_TYPE_LABELS } from "@/lib/challenges"

interface Props {
    classId: string
    onChallengeCreated?: (challenge: any) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

type SelectImageOption = {
    id: string
    label: string
    imageUrl: string
    imageStoragePath?: string | null
    file?: File | null
    previewUrl?: string | null
}

type FillBlankSectionDraft = {
    id: string
    label: string
    imageUrl?: string
    imageStoragePath?: string | null
    file?: File | null
    previewUrl?: string | null
}

const createEmptySelectImageOption = (id?: string): SelectImageOption => ({
    id: id || `img-${Date.now()}`,
    label: "",
    imageUrl: "",
    imageStoragePath: null,
    file: null,
    previewUrl: null,
})

const revokePreview = (option?: SelectImageOption | null) => {
    if (option?.previewUrl) {
        try {
            URL.revokeObjectURL(option.previewUrl)
        } catch (_) {
            // ignore revoke errors
        }
    }
}

const createEmptyFillBlankSection = (id?: string): FillBlankSectionDraft => ({
    id: id || `fb-${Date.now()}`,
    label: "",
    imageUrl: "",
    imageStoragePath: null,
    file: null,
    previewUrl: null,
})

const revokeSectionPreview = (section?: FillBlankSectionDraft | null) => {
    if (section?.previewUrl) {
        try {
            URL.revokeObjectURL(section.previewUrl)
        } catch (_) {
            // ignore revoke errors
        }
    }
}

const challengeTypeOrder = [
    "multiple_choice",
    "fill_blank",
    "select_image",
    "matching",
    "open_ended",
    "sign_practice",
]

const createDefaultRubricCriteria = () => ([
    { id: "crit-claridad", label: "Claridad", weight: 40, description: "Señales legibles y consistentes." },
    { id: "crit-expresividad", label: "Expresividad", weight: 30, description: "Uso de expresiones faciales y corporales apropiadas." },
    { id: "crit-precision", label: "Precisión", weight: 30, description: "Configuración correcta de manos y trayectoria." },
])

type ValidationResult = {
    payload: any
    rubric?: Array<{ id: string; label: string; weight: number; description: string }>
    maxScore?: number
    referenceVideoFile?: File | null
    referenceVideoDurationSeconds?: number | null
    referenceVideoTranscript?: string | null
    selectImageOptions?: SelectImageOption[]
    fillBlankPromptImage?: { file: File | null; imageStoragePath: string | null }
    fillBlankSections?: FillBlankSectionDraft[]
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
    const [fillPromptImage, setFillPromptImage] = useState<{ file: File | null; previewUrl: string | null; imageStoragePath: string | null }>({
        file: null,
        previewUrl: null,
        imageStoragePath: null,
    })
    const [fillSections, setFillSections] = useState<FillBlankSectionDraft[]>([createEmptyFillBlankSection("fb-1")])
    const fillSectionsRef = useRef(fillSections)

    const [selectImageOptions, setSelectImageOptions] = useState<SelectImageOption[]>([
        createEmptySelectImageOption("img-1"),
    ])
    const selectImageOptionsRef = useRef(selectImageOptions)
    const fillPromptImageRef = useRef(fillPromptImage)

    const cleanupSelectImagePreviews = () => {
        selectImageOptionsRef.current.forEach(revokePreview)
    }

    const cleanupFillSectionPreviews = () => {
        fillSectionsRef.current.forEach(revokeSectionPreview)
    }

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
    const [rubricCriteria, setRubricCriteria] = useState<Array<{ id: string; label: string; weight: number; description: string }>>(createDefaultRubricCriteria())
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

    useEffect(() => {
        selectImageOptionsRef.current = selectImageOptions
    }, [selectImageOptions])

    useEffect(() => {
        fillSectionsRef.current = fillSections
    }, [fillSections])

    useEffect(() => {
        fillPromptImageRef.current = fillPromptImage
    }, [fillPromptImage])

    useEffect(() => {
        return () => {
            cleanupSelectImagePreviews()
            cleanupFillSectionPreviews()
            const promptImage = fillPromptImageRef.current
            if (promptImage?.previewUrl) {
                try {
                    URL.revokeObjectURL(promptImage.previewUrl)
                } catch (_) {
                    // ignore
                }
            }
        }
    }, [])

    const handleSelectImageFileChange = (index: number, file: File | null) => {
        setSelectImageOptions((prev) =>
            prev.map((opt, i) => {
                if (i !== index) return opt
                revokePreview(opt)
                if (!file) {
                    return { ...opt, file: null, previewUrl: null }
                }
                const previewUrl = URL.createObjectURL(file)
                return {
                    ...opt,
                    file,
                    previewUrl,
                    imageUrl: "",
                    imageStoragePath: null,
                }
            }),
        )
    }

    const removeSelectImageOption = (index: number) => {
        setSelectImageOptions((prev) => {
            if (index < 0 || index >= prev.length) return prev
            const target = prev[index]
            revokePreview(target)
            return prev.filter((_, i) => i !== index)
        })
    }

    const addSelectImageOption = () => {
        setSelectImageOptions((prev) => [...prev, createEmptySelectImageOption()])
    }

    const handleFillPromptImageChange = (file: File | null) => {
        setFillPromptImage((prev) => {
            if (prev.previewUrl) {
                try {
                    URL.revokeObjectURL(prev.previewUrl)
                } catch (_) {
                    // ignore
                }
            }
            if (!file) {
                return { file: null, previewUrl: null, imageStoragePath: null }
            }
            return { file, previewUrl: URL.createObjectURL(file), imageStoragePath: null }
        })
    }

    const addFillSection = () => {
        setFillSections((prev) => [...prev, createEmptyFillBlankSection()])
    }

    const updateFillSectionLabel = (sectionId: string, value: string) => {
        setFillSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, label: value } : section)))
    }

    const handleFillSectionFileChange = (sectionId: string, file: File | null) => {
        setFillSections((prev) =>
            prev.map((section) => {
                if (section.id !== sectionId) return section
                if (section.previewUrl) {
                    revokeSectionPreview(section)
                }
                if (!file) {
                    return { ...section, file: null, previewUrl: null, imageStoragePath: null, imageUrl: "" }
                }
                return {
                    ...section,
                    file,
                    previewUrl: URL.createObjectURL(file),
                    imageStoragePath: null,
                    imageUrl: "",
                }
            }),
        )
    }

    const removeFillSection = (sectionId: string) => {
        setFillSections((prev) => {
            const target = prev.find((section) => section.id === sectionId)
            revokeSectionPreview(target)
            return prev.filter((section) => section.id !== sectionId)
        })
    }

    const totalRubricWeight = useMemo(() => rubricCriteria.reduce((acc, crit) => acc + (Number(crit.weight) || 0), 0), [rubricCriteria])

    const previewPayload = () => {
        if (type === "multiple_choice") {
            return { prompt: mcQuestion, options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex }
        }
        if (type === "fill_blank") {
            return {
                prompt: fillPrompt,
                promptImageStoragePath: fillPromptImage.imageStoragePath,
                sections: fillSections.map((section) => ({
                    id: section.id,
                    label: section.label,
                    imageStoragePath: section.imageStoragePath,
                })),
            }
        }
        if (type === "select_image") return { options: selectImageOptions.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl, imageStoragePath: o.imageStoragePath })) }
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

    const validateAndBuildPayload = (): ValidationResult => {
        // returns payload or throws Error with user-friendly message
        if (!title.trim()) throw new Error("El título es obligatorio")

        if (type === "multiple_choice") {
            if (mcOptions.length < 2) throw new Error("Agrega al menos 2 opciones para selección múltiple")
            if (mcOptions.some((o) => !o.text || !o.text.trim())) throw new Error("Todas las opciones deben tener texto")
            if (mcCorrectIndex < 0 || mcCorrectIndex >= mcOptions.length) throw new Error("Selecciona la opción correcta")
            if (!mcQuestion.trim()) throw new Error("Escribe la pregunta para la selección múltiple")
            return { payload: { prompt: mcQuestion.trim(), options: mcOptions.map((o) => ({ id: o.id, text: o.text })), correct_index: mcCorrectIndex } }
        }

        if (type === "fill_blank") {
            const promptValue = fillPrompt.trim()
            const normalizedSections = fillSections
                .map((section) => ({
                    ...section,
                    label: section.label.trim(),
                }))
                .filter((section) => section.label || section.file || section.imageStoragePath || section.imageUrl)

            const hasPromptMedia = !!fillPromptImage.file || !!fillPromptImage.imageStoragePath
            if (!promptValue && normalizedSections.length === 0 && !hasPromptMedia) {
                throw new Error("Agrega un enunciado o al menos una imagen para contextualizar el ejercicio")
            }

            const invalidSection = normalizedSections.find((section) => {
                const hasImage = !!section.file || !!section.imageStoragePath || !!section.imageUrl
                return !hasImage
            })
            if (invalidSection) {
                throw new Error("Cada segmento visual debe incluir una imagen")
            }

            return {
                payload: { prompt: promptValue },
                fillBlankPromptImage: { file: fillPromptImage.file, imageStoragePath: fillPromptImage.imageStoragePath },
                fillBlankSections: normalizedSections,
            }
        }

        if (type === "select_image") {
            if (selectImageOptions.length < 2) throw new Error("Agrega al menos 2 opciones con imagen")
            const normalized = selectImageOptions.map((opt) => ({
                ...opt,
                label: opt.label.trim(),
                imageUrl: (opt.imageUrl || "").trim(),
            }))
            normalized.forEach((opt) => {
                if (!opt.label) throw new Error("Cada opción debe tener una etiqueta")
                const hasRemoteUrl = !!opt.imageUrl
                const hasFile = !!opt.file
                const hasStoredPath = !!opt.imageStoragePath
                if (!hasRemoteUrl && !hasFile && !hasStoredPath) {
                    throw new Error("Cada opción debe tener una imagen (archivo o URL)")
                }
            })
            return {
                payload: {
                    options: normalized.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl, imageStoragePath: o.imageStoragePath ?? null })),
                },
                selectImageOptions: normalized,
            }
        }

        if (type === "matching") {
            if (matchingPairs.length < 1) throw new Error("Agrega al menos un par para emparejar columnas")
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

    const resetForm = () => {
        setTitle("")
        setDescription("")
        setType("multiple_choice")
        setPayload(null)
        setMcQuestion("")
        setMcOptions([{ id: "opt-1", text: "" }])
        setMcCorrectIndex(0)
        setFillPrompt("")
        const promptImage = fillPromptImageRef.current
        if (promptImage?.previewUrl) {
            try {
                URL.revokeObjectURL(promptImage.previewUrl)
            } catch (_) {
                // ignore
            }
        }
        setFillPromptImage({ file: null, previewUrl: null, imageStoragePath: null })
        cleanupFillSectionPreviews()
        setFillSections([createEmptyFillBlankSection("fb-1")])
        cleanupSelectImagePreviews()
        setSelectImageOptions([createEmptySelectImageOption("img-1")])
        setMatchingPairs([{ id: "pair-1", left: "", right: "" }])
        setOpenPrompt("")
        setSignPrompt("")
        setSignTips("")
        setSignReferenceTranscript("")
        setSignReferenceDuration("")
        setSignReferenceVideoFile(null)
        setSignMaxScore("100")
        setRubricCriteria(createDefaultRubricCriteria())
        setStartAt(null)
        setDueAt(null)
        setError(null)
    }

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) resetForm()
        onOpenChange && onOpenChange(nextOpen)
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
                // do not mutate payloadJson with storage path (payload has a strict type); storage path is stored separately in the DB row
            }

            if (type === "select_image" && built.selectImageOptions) {
                const uploadedOptions: Array<{ id: string; label: string; imageUrl: string; imageStoragePath: string | null }> = []
                for (const option of built.selectImageOptions) {
                    let imageUrl = option.imageUrl || ""
                    let imageStoragePath = option.imageStoragePath ?? null
                    if (option.file) {
                        const file = option.file
                        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
                        const rawBase = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
                        const safeBase = sanitizeFilename(rawBase) || "imagen"
                        const objectPath = `challenges/${classId}/select-image/${option.id}-${safeBase}-${Date.now()}.${extension}`
                        const uploadResp = await supabase.storage.from("library").upload(objectPath, file, {
                            upsert: true,
                            contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
                        })
                        if (uploadResp.error) throw uploadResp.error
                        imageStoragePath = objectPath
                        // si existía una URL remota se respeta, de lo contrario se resolverá con el path
                        if (!/^https?:\/\//i.test(imageUrl)) {
                            imageUrl = ""
                        }
                    }
                    uploadedOptions.push({ id: option.id, label: option.label, imageUrl, imageStoragePath })
                }
                payloadJson = { options: uploadedOptions }
            }

            if (type === "fill_blank") {
                let promptImageStoragePath = built.fillBlankPromptImage?.imageStoragePath ?? null
                if (built.fillBlankPromptImage?.file) {
                    const file = built.fillBlankPromptImage.file
                    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
                    const rawBase = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
                    const safeBase = sanitizeFilename(rawBase) || "prompt"
                    const objectPath = `challenges/${classId}/fill-blank/prompt-${safeBase}-${Date.now()}.${extension}`
                    const uploadResp = await supabase.storage.from("library").upload(objectPath, file, {
                        upsert: true,
                        contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
                    })
                    if (uploadResp.error) throw uploadResp.error
                    promptImageStoragePath = objectPath
                }

                const processedSections: Array<{ id: string; label: string; imageUrl?: string; imageStoragePath: string | null }> = []
                for (const section of built.fillBlankSections || []) {
                    let imageStoragePath = section.imageStoragePath ?? null
                    let imageUrl = section.imageUrl || ""
                    if (section.file) {
                        const file = section.file
                        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
                        const rawBase = file.name.substring(0, file.name.lastIndexOf(".")) || file.name
                        const safeBase = sanitizeFilename(rawBase) || section.id
                        const objectPath = `challenges/${classId}/fill-blank/${section.id}-${safeBase}-${Date.now()}.${extension}`
                        const uploadResp = await supabase.storage.from("library").upload(objectPath, file, {
                            upsert: true,
                            contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
                        })
                        if (uploadResp.error) throw uploadResp.error
                        imageStoragePath = objectPath
                        if (!/^https?:\/\//i.test(imageUrl)) {
                            imageUrl = ""
                        }
                    }
                    processedSections.push({ id: section.id, label: section.label, imageUrl, imageStoragePath })
                }

                payloadJson = {
                    ...payloadJson,
                    promptImageStoragePath,
                    sections: processedSections,
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
            handleDialogOpenChange(false)
        } catch (err) {
            console.error("Error creating challenge:", err)
            const msg = (err as any)?.message || "Error creando el desafío"
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
                            {challengeTypeOrder.map((value) => (
                                <SelectItem key={value} value={value}>
                                    {value === "sign_practice" ? `${CHALLENGE_TYPE_LABELS[value]} (video)` : CHALLENGE_TYPE_LABELS[value]}
                                </SelectItem>
                            ))}
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
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm">Enunciado principal</label>
                                <Textarea value={fillPrompt} onChange={(e) => setFillPrompt(e.target.value)} placeholder="Describe la oración o el contexto" />
                                <p className="text-xs text-muted-foreground mt-1">Agrega una instrucción breve y usa las imágenes para representar cada segmento en LSN.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm">Imagen del enunciado (opcional)</label>
                                <Input type="file" accept="image/*" onChange={(e) => handleFillPromptImageChange(e.target.files?.[0] || null)} />
                                {(fillPromptImage.previewUrl || fillPromptImage.imageStoragePath) && (
                                    <div className="space-y-2">
                                        <img
                                            src={fillPromptImage.previewUrl || (fillPromptImage.imageStoragePath ? `/api/library/object?path=${encodeURIComponent(fillPromptImage.imageStoragePath)}` : "")}
                                            alt="Imagen del enunciado"
                                            className="h-32 w-full rounded-md object-cover"
                                        />
                                        <Button type="button" variant="ghost" size="sm" onClick={() => handleFillPromptImageChange(null)}>
                                            Quitar imagen
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Segmentos con imagen</p>
                                        <p className="text-xs text-muted-foreground">Sube imágenes en orden para que el estudiante escriba cada parte de la oración.</p>
                                    </div>
                                    <Button type="button" variant="outline" onClick={addFillSection}>
                                        Añadir imagen
                                    </Button>
                                </div>

                                {fillSections.length === 0 && (
                                    <p className="text-xs text-muted-foreground border rounded-md p-3">Agrega al menos una imagen si deseas que el estudiante forme la oración a partir de señas.</p>
                                )}

                                <div className="space-y-3">
                                    {fillSections.map((section, idx) => {
                                        const storedPreview = section.imageStoragePath ? `/api/library/object?path=${encodeURIComponent(section.imageStoragePath)}` : null
                                        const previewSrc = section.previewUrl || storedPreview
                                        return (
                                            <div key={section.id} className="rounded-md border p-3 space-y-3">
                                                <div className="flex flex-col gap-2 md:flex-row">
                                                    <Input
                                                        placeholder={`Descripción de la imagen ${idx + 1}`}
                                                        value={section.label}
                                                        onChange={(e) => updateFillSectionLabel(section.id, e.target.value)}
                                                    />
                                                    <Button type="button" variant="ghost" onClick={() => removeFillSection(section.id)} disabled={fillSections.length <= 1}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted-foreground">Archivo de imagen</label>
                                                    <Input type="file" accept="image/*" onChange={(e) => handleFillSectionFileChange(section.id, e.target.files?.[0] || null)} />
                                                    {section.file && (
                                                        <p className="text-xs text-muted-foreground mt-1">Seleccionado: {section.file.name}</p>
                                                    )}
                                                </div>
                                                {previewSrc ? (
                                                    <div className="space-y-2">
                                                        <img src={previewSrc} alt={section.label || `Imagen ${idx + 1}`} className="h-40 w-full rounded-md object-cover" />
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => handleFillSectionFileChange(section.id, null)}>
                                                            Quitar imagen
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">Adjunta un archivo para este segmento.</p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {type === "select_image" && (
                        <div className="space-y-3">
                            <p className="text-sm">Opciones con imagen</p>
                            {selectImageOptions.map((opt, idx) => {
                                const previewSrc = opt.previewUrl || (opt.imageUrl ? opt.imageUrl : null)
                                return (
                                    <div key={opt.id} className="space-y-2 rounded-md border p-3">
                                        <div className="flex flex-col gap-2 md:flex-row">
                                            <Input
                                                placeholder="Etiqueta"
                                                value={opt.label}
                                                onChange={(e) =>
                                                    setSelectImageOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                                                }
                                            />
                                            <Button type="button" variant="ghost" onClick={() => removeSelectImageOption(idx)}>
                                                Eliminar
                                            </Button>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">URL directa (opcional)</label>
                                                <Input
                                                    placeholder="https://"
                                                    value={opt.imageUrl}
                                                    onChange={(e) =>
                                                        setSelectImageOptions((prev) =>
                                                            prev.map((p, i) => (i === idx ? { ...p, imageUrl: e.target.value } : p)),
                                                        )
                                                    }
                                                    disabled={!!opt.file}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Sube un archivo (recomendado)</label>
                                                <Input
                                                    key={`${opt.id}-${opt.previewUrl || "remote"}`}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleSelectImageFileChange(idx, e.target.files?.[0] || null)}
                                                />
                                                {opt.file ? (
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>{opt.file.name}</span>
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => handleSelectImageFileChange(idx, null)}>
                                                            Quitar archivo
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {previewSrc ? (
                                                <img src={previewSrc} alt={opt.label || "Previsualización"} className="h-24 w-24 rounded-md object-cover" />
                                            ) : (
                                                <div className="flex h-24 w-24 items-center justify-center rounded-md border text-xs text-muted-foreground">
                                                    Sin vista previa
                                                </div>
                                            )}
                                            {opt.imageStoragePath && !previewSrc && (
                                                <span className="text-xs text-muted-foreground">La imagen se mostrará después de guardar.</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            <Button type="button" variant="outline" onClick={addSelectImageOption}>
                                Añadir opción
                            </Button>
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
                                <div className="space-y-3">
                                    <p className="font-medium">{fillPrompt || "(Enunciado vacío)"}</p>
                                    {(fillPromptImage.previewUrl || fillPromptImage.imageStoragePath) && (
                                        <img
                                            src={fillPromptImage.previewUrl || (fillPromptImage.imageStoragePath ? `/api/library/object?path=${encodeURIComponent(fillPromptImage.imageStoragePath)}` : "")}
                                            alt="Imagen del enunciado"
                                            className="h-32 w-full rounded-md object-cover"
                                        />
                                    )}
                                    {fillSections.length > 0 && (
                                        <div className="space-y-2">
                                            {fillSections.map((section, idx) => {
                                                const storedPreview = section.imageStoragePath ? `/api/library/object?path=${encodeURIComponent(section.imageStoragePath)}` : null
                                                const previewSrc = section.previewUrl || storedPreview
                                                return (
                                                    <div key={section.id} className="rounded border p-2">
                                                        <p className="text-sm font-medium">Imagen {idx + 1}: {section.label || "(sin descripción)"}</p>
                                                        {previewSrc ? (
                                                            <img src={previewSrc} alt={section.label || `Imagen ${idx + 1}`} className="mt-2 h-32 w-full rounded-md object-cover" />
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">Adjunta un archivo para mostrar aquí.</p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {type === "select_image" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {selectImageOptions.map((opt) => {
                                        const previewSrc = opt.previewUrl || (opt.imageUrl ? opt.imageUrl : null)
                                        return (
                                            <div key={opt.id} className="flex items-center gap-2 rounded border p-2">
                                                {previewSrc ? (
                                                    <img src={previewSrc} alt={opt.label} className="h-20 w-20 rounded object-cover" />
                                                ) : (
                                                    <div className="flex h-20 w-20 items-center justify-center rounded bg-muted text-xs text-muted-foreground">Sin imagen</div>
                                                )}
                                                <div>
                                                    <div className="font-medium">{opt.label || "(etiqueta)"}</div>
                                                    {opt.imageUrl && !opt.previewUrl && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-[12rem]">{opt.imageUrl}</p>
                                                    )}
                                                    {opt.previewUrl && <p className="text-xs text-muted-foreground">Archivo local listo para subir</p>}
                                                </div>
                                            </div>
                                        )
                                    })}
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
                    <Button variant="ghost" onClick={() => handleDialogOpenChange(false)} disabled={loading}>
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
