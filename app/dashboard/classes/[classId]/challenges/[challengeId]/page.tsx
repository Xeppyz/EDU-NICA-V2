"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getChallengeTypeLabel } from "@/lib/challenges"

const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobado",
    needs_revision: "Revisar",
}

const statusClasses: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    needs_revision: "bg-rose-100 text-rose-800",
}

export default function ChallengeReviewPage() {
    const params = useParams() as { classId?: string; challengeId?: string }
    const classId = params.classId || ""
    const challengeId = params.challengeId || ""
    const router = useRouter()

    const [user, setUser] = useState<any>(null)
    const [challenge, setChallenge] = useState<any | null>(null)
    const [responses, setResponses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null)

    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [selectedResponse, setSelectedResponse] = useState<any | null>(null)
    const [feedback, setFeedback] = useState("")
    const [status, setStatus] = useState("pending")
    const [score, setScore] = useState("")
    const [rubricScoreInputs, setRubricScoreInputs] = useState<Record<string, number>>({})
    const [submissionVideoUrl, setSubmissionVideoUrl] = useState<string | null>(null)
    const [savingReview, setSavingReview] = useState(false)
    const [videoLoading, setVideoLoading] = useState(false)
    const [videoError, setVideoError] = useState<string | null>(null)

    const rubricCriteria = useMemo(() => {
        if (!challenge?.rubric || !Array.isArray(challenge.rubric)) return []
        return challenge.rubric
    }, [challenge?.rubric])

    const awardedRubricPoints = useMemo(() => Object.values(rubricScoreInputs).reduce((acc, val) => acc + (Number(val) || 0), 0), [rubricScoreInputs])

    const getOptionImageSrc = (option: any) => {
        if (!option) return null
        if (typeof option.imageUrl === "string" && option.imageUrl.trim()) return option.imageUrl
        const storagePath = option.imageStoragePath || option.image_storage_path
        if (!storagePath) return null
        return `/api/library/object?path=${encodeURIComponent(storagePath)}`
    }

    const getFillPromptImageSrc = (payload: any) => {
        if (!payload) return null
        if (typeof payload.promptImageUrl === "string" && payload.promptImageUrl.trim()) return payload.promptImageUrl
        const storagePath = payload.promptImageStoragePath || payload.prompt_image_storage_path
        if (!storagePath) return null
        return `/api/library/object?path=${encodeURIComponent(storagePath)}`
    }

    const getFillSectionImageSrc = (section: any) => {
        if (!section) return null
        if (typeof section.imageUrl === "string" && section.imageUrl.trim()) return section.imageUrl
        const storagePath = section.imageStoragePath || section.image_storage_path
        if (!storagePath) return null
        return `/api/library/object?path=${encodeURIComponent(storagePath)}`
    }

    const renderAnswerDetails = () => {
        if (!selectedResponse || !challenge) return null
        const answers = selectedResponse.answers || {}
        const payload = challenge.payload || {}

        if (challenge.type === "multiple_choice") {
            const options = Array.isArray(payload.options) ? payload.options : []
            const selected = options.find((opt: any) => opt.id === answers.selected)
            return (
                <div>
                    <p className="text-sm font-medium">Respuesta seleccionada</p>
                    {selected ? (
                        <div className="mt-2 rounded border p-2">
                            <p className="font-medium">{selected.text || selected.label || "(sin texto)"}</p>
                            <p className="text-xs text-muted-foreground">ID: {selected.id}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">El estudiante no seleccionó una opción.</p>
                    )}
                </div>
            )
        }

        if (challenge.type === "select_image") {
            const options = Array.isArray(payload.options) ? payload.options : []
            const selected = options.find((opt: any) => opt.id === answers.selected)
            return (
                <div>
                    <p className="text-sm font-medium">Imagen seleccionada</p>
                    {selected ? (
                        <div className="mt-2 flex items-center gap-3 rounded border p-2">
                            {(() => {
                                const src = getOptionImageSrc(selected)
                                return src ? (
                                    <img src={src} alt={selected.label || "Imagen seleccionada"} className="h-20 w-20 rounded object-cover" />
                                ) : (
                                    <div className="h-20 w-20 rounded bg-muted" />
                                )
                            })()}
                            <div>
                                <p className="font-medium">{selected.label || "(sin etiqueta)"}</p>
                                {selected.imageUrl && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[14rem]">{selected.imageUrl}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">El estudiante no seleccionó ninguna imagen.</p>
                    )}
                </div>
            )
        }

        if (challenge.type === "fill_blank") {
            const sections = Array.isArray(payload.sections) ? payload.sections : []
            const sectionAnswers = Array.isArray(answers.sections) ? answers.sections : []
            if (sections.length === 0) {
                return (
                    <div>
                        <p className="text-sm font-medium">Texto ingresado</p>
                        <p className="mt-2 rounded border bg-muted/30 p-2 text-sm whitespace-pre-wrap">{answers.text || "(sin respuesta)"}</p>
                    </div>
                )
            }
            return (
                <div className="space-y-3">
                    <p className="text-sm font-medium">Respuestas por imagen</p>
                    {sections.map((section: any, index: number) => {
                        const sectionId = section.id || `section-${index}`
                        const sectionImage = getFillSectionImageSrc(section)
                        const response = sectionAnswers.find((entry: any, entryIdx: number) => {
                            const answerId = entry.sectionId || entry.id || `section-${entryIdx}`
                            return answerId === sectionId
                        })
                        return (
                            <div key={sectionId} className="rounded border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">Segmento {index + 1}</p>
                                    {section.label && <span className="text-xs text-muted-foreground">{section.label}</span>}
                                </div>
                                {sectionImage && <img src={sectionImage} alt={section.label || `Segmento ${index + 1}`} className="w-full rounded-md object-cover max-h-64" />}
                                <p className="text-sm text-muted-foreground">Respuesta del estudiante:</p>
                                <p className="rounded bg-muted/30 p-2 text-sm whitespace-pre-wrap">{response?.text || "(sin respuesta)"}</p>
                            </div>
                        )
                    })}
                </div>
            )
        }

        if (challenge.type === "matching") {
            const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
            const pairMap = new Map<string, { left?: string; right?: string }>(
                pairs.map((pair: any) => [pair.id, { left: pair.left, right: pair.right }]),
            )
            const matches = Array.isArray(answers.matches) ? answers.matches : []
            return (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Correspondencias realizadas</p>
                    {matches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">El estudiante no envió emparejamientos.</p>
                    ) : (
                        <div className="space-y-1">
                            {matches.map((match: any) => {
                                const leftPair = pairMap.get(match.pairId)
                                const selectedPair = pairMap.get(match.right) || pairMap.get(match.selectedId)
                                return (
                                    <div key={`${match.pairId}-${match.right}`} className="rounded border p-2 text-sm">
                                        <p className="font-semibold">{leftPair?.left || match.pairId}</p>
                                        <p className="text-muted-foreground text-sm">→ {selectedPair?.right || match.right || "(sin selección)"}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )
        }

        if (challenge.type === "open_ended") {
            return (
                <div>
                    <p className="text-sm font-medium">Respuesta abierta</p>
                    <p className="mt-2 rounded border bg-muted/30 p-2 text-sm whitespace-pre-wrap">{answers.text || "(sin respuesta)"}</p>
                </div>
            )
        }

        if (challenge.type === "sign_practice") {
            return (
                <div>
                    <p className="text-sm font-medium">Notas del estudiante</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{answers.notes || "(sin notas)"}</p>
                </div>
            )
        }

        return null
    }

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
                if (!currentUser) {
                    router.push("/auth/login")
                    return
                }

                const supabase = getSupabaseClient()
                const { data: challengeData, error: challengeError } = await supabase
                    .from("challenges")
                    .select("*, classes:class_id(id, name)")
                    .eq("id", challengeId)
                    .single()
                if (challengeError) throw challengeError
                if (!challengeData || challengeData.teacher_id !== currentUser.id) {
                    setError("No tienes acceso a este desafío")
                    return
                }
                setChallenge(challengeData)

                if (challengeData.reference_video_storage_path) {
                    try {
                        const signed = await getSignedUrl(challengeData.reference_video_storage_path)
                        if (signed) setReferenceVideoUrl(signed)
                    } catch (error) {
                        console.warn("No se pudo obtener el video de referencia", error)
                    }
                }

                const { data: respData, error: respError } = await supabase
                    .from("challenge_responses")
                    .select("*, student:student_id(full_name, email)")
                    .eq("challenge_id", challengeId)
                    .order("created_at", { ascending: false })
                if (respError) throw respError
                setResponses(respData || [])
            } catch (err: any) {
                console.error("Error loading challenge", err)
                setError(err?.message || "No se pudo cargar el desafío")
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [challengeId, router])

    const getSignedUrl = async (path: string) => {
        try {
            const res = await fetch("/api/library/signed-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, expires: 60 * 60 }),
            })
            if (res.ok) {
                const json = await res.json()
                if (json?.signedURL) return json.signedURL
            }
        } catch (e) {
            console.warn("Fallo la API de signed-url, intentando fallback", e)
        }

        // fallback directo al cliente supabase usando la sesión del docente
        try {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase.storage.from("library").createSignedUrl(path, 60 * 60)
            if (error) throw error
            const direct = data?.signedUrl || (data as any)?.signedURL
            return direct || null
        } catch (e) {
            console.error("No se pudo obtener URL firmada via Supabase", e)
            return null
        }
    }

    const fetchSubmissionVideo = async (path: string) => {
        setVideoLoading(true)
        setVideoError(null)
        try {
            const signed = await getSignedUrl(path)
            if (!signed) throw new Error("No se pudo generar la URL firmada")
            setSubmissionVideoUrl(signed)
        } catch (error: any) {
            console.error("No se pudo firmar el video", error)
            setSubmissionVideoUrl(null)
            setVideoError(error?.message || "No se pudo cargar el video")
        } finally {
            setVideoLoading(false)
        }
    }

    const openReview = async (response: any) => {
        setSelectedResponse(response)
        setFeedback(response.teacher_feedback || "")
        setStatus(response.review_status || "pending")
        setScore(
            response.score !== null && response.score !== undefined
                ? String(response.score)
                : challenge?.max_score
                    ? String(challenge.max_score)
                    : ""
        )
        const initial: Record<string, number> = {}
        rubricCriteria.forEach((crit: any) => {
            const key = crit.id || crit.label
            const existing = response.rubric_scores?.[key] ?? response.rubric_scores?.[crit.label]
            initial[key] = typeof existing === "number" ? existing : 0
        })
        setRubricScoreInputs(initial)
        if (response.submission_storage_path) {
            await fetchSubmissionVideo(response.submission_storage_path)
        } else {
            setSubmissionVideoUrl(null)
            setVideoLoading(false)
            setVideoError(null)
        }
        setReviewDialogOpen(true)
    }

    const closeReview = () => {
        setReviewDialogOpen(false)
        setSelectedResponse(null)
        setFeedback("")
        setScore("")
        setRubricScoreInputs({})
        setSubmissionVideoUrl(null)
        setVideoLoading(false)
        setVideoError(null)
    }

    const handleSaveReview = async () => {
        if (!selectedResponse || !user) return
        if (!status) {
            alert("Selecciona un estado")
            return
        }
        let parsedScore: number | null = null
        if (score.trim()) {
            const val = Number(score)
            if (Number.isNaN(val)) {
                alert("Ingresa un puntaje válido")
                return
            }
            parsedScore = val
        }
        const rubricPayload = rubricCriteria.length
            ? rubricCriteria.reduce((acc: Record<string, number>, crit: any) => {
                const key = crit.id || crit.label
                acc[key] = Number(rubricScoreInputs[key]) || 0
                return acc
            }, {})
            : null

        try {
            setSavingReview(true)
            const supabase = getSupabaseClient()
            const updates = {
                teacher_feedback: feedback.trim() || null,
                review_status: status,
                rubric_scores: rubricPayload,
                score: parsedScore,
                reviewer_id: user.id,
                reviewed_at: new Date().toISOString(),
            }
            const { data, error: updateError } = await supabase
                .from("challenge_responses")
                .update(updates)
                .eq("id", selectedResponse.id)
                .select("*, student:student_id(full_name, email)")
                .single()
            if (updateError) throw updateError
            setResponses((prev) => prev.map((resp) => (resp.id === data.id ? data : resp)))
            closeReview()
        } catch (err: any) {
            console.error("Error guardando revisión", err)
            alert(err?.message || "No se pudo guardar la revisión")
        } finally {
            setSavingReview(false)
        }
    }

    if (loading) {
        return <div className="p-6">Cargando desafío...</div>
    }

    if (!challenge) {
        return (
            <div className="p-6 space-y-4">
                <p>{error || "No se encontró el desafío"}</p>
                <Button variant="outline" onClick={() => router.push(`/dashboard/classes/${classId}`)}>Volver a la clase</Button>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{challenge.title}</h1>
                    <p className="text-muted-foreground">{challenge.description || "Sin descripción"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clase: {challenge.classes?.name || classId}</p>
                </div>
                <Button variant="outline" onClick={() => router.push(`/dashboard/classes/${classId}`)}>← Volver</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Detalles del reto</CardTitle>
                        <CardDescription>Tipo: {getChallengeTypeLabel(challenge.type)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {challenge.payload?.prompt && (
                            <div>
                                <p className="text-sm font-medium">Instrucciones</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.payload.prompt}</p>
                            </div>
                        )}
                        {challenge.type === "fill_blank" && (() => {
                            const promptImage = getFillPromptImageSrc(challenge.payload || {})
                            const sections = Array.isArray(challenge.payload?.sections) ? challenge.payload.sections : []
                            return (
                                <div className="space-y-3">
                                    {promptImage && <img src={promptImage} alt="Imagen del enunciado" className="w-full rounded-md object-cover max-h-64" />}
                                    {sections.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Segmentos visuales</p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {sections.map((section: any, index: number) => {
                                                    const sectionImage = getFillSectionImageSrc(section)
                                                    return (
                                                        <div key={section.id || index} className="rounded border p-2 text-sm">
                                                            <p className="font-semibold">{section.label || `Segmento ${index + 1}`}</p>
                                                            {sectionImage ? (
                                                                <img src={sectionImage} alt={section.label || `Segmento ${index + 1}`} className="mt-2 h-32 w-full rounded object-cover" />
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground mt-2">Sin imagen adjunta</p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                        {challenge.payload?.tips && (
                            <div>
                                <p className="text-sm font-medium">Tips</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.payload.tips}</p>
                            </div>
                        )}
                        {referenceVideoUrl && (
                            <div>
                                <p className="text-sm font-medium mb-2">Video de referencia</p>
                                <video controls className="w-full rounded border" src={referenceVideoUrl} />
                            </div>
                        )}
                        {challenge.reference_video_transcript && (
                            <div>
                                <p className="text-sm font-medium">Transcripción</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.reference_video_transcript}</p>
                            </div>
                        )}
                        {rubricCriteria.length > 0 && (
                            <div>
                                <p className="text-sm font-medium">Rúbrica (máx. {challenge.max_score || 100} pts)</p>
                                <div className="border rounded divide-y mt-2">
                                    {rubricCriteria.map((crit: any) => (
                                        <div key={crit.id || crit.label} className="p-2 flex justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{crit.label}</p>
                                                {crit.description && <p className="text-xs text-muted-foreground">{crit.description}</p>}
                                            </div>
                                            <span className="text-sm font-medium">{crit.weight} pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Entregas de estudiantes</CardTitle>
                        <CardDescription>{responses.length} envíos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {responses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nadie ha enviado este reto todavía.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Estudiante</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Puntaje</TableHead>
                                        <TableHead>Enviado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {responses.map((resp) => (
                                        <TableRow key={resp.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{resp.student?.full_name || resp.student_id}</p>
                                                    <p className="text-xs text-muted-foreground">{resp.student?.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusClasses[resp.review_status] || ""}>
                                                    {statusLabels[resp.review_status] || resp.review_status || "Sin estado"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {resp.score !== null && resp.score !== undefined ? `${resp.score}` : "—"}
                                            </TableCell>
                                            <TableCell>
                                                {resp.completed_at
                                                    ? new Date(resp.completed_at).toLocaleString()
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => openReview(resp)}>
                                                    Revisar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={reviewDialogOpen} onOpenChange={(open) => (open ? setReviewDialogOpen(true) : closeReview())}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Revisar envío</DialogTitle>
                        {selectedResponse && (
                            <p className="text-sm text-muted-foreground">
                                {selectedResponse.student?.full_name || selectedResponse.student_id}
                            </p>
                        )}
                    </DialogHeader>
                    <div className="space-y-4">
                        {challenge.type === "sign_practice" && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium mb-1">Video del estudiante</p>
                                    {videoLoading ? (
                                        <div className="h-48 rounded border border-dashed bg-muted animate-pulse" />
                                    ) : submissionVideoUrl ? (
                                        <div className="space-y-2">
                                            <video controls className="w-full rounded border" src={submissionVideoUrl} />
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="secondary" size="sm" onClick={() => window.open(submissionVideoUrl || "", "_blank")}>Abrir en pestaña</Button>
                                                <Button type="button" variant="ghost" size="sm" asChild>
                                                    <a href={submissionVideoUrl} download>
                                                        Descargar
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    ) : selectedResponse?.submission_storage_path ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                {videoError || "Cargando video firmado…"}
                                            </p>
                                            {videoError && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => selectedResponse?.submission_storage_path && fetchSubmissionVideo(selectedResponse.submission_storage_path)}
                                                >
                                                    Reintentar
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Este estudiante aún no adjunta un video.</p>
                                    )}
                                </div>
                                {referenceVideoUrl && (
                                    <div>
                                        <p className="text-sm font-medium mb-1">Video de referencia</p>
                                        <video controls className="w-full rounded border" src={referenceVideoUrl} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div>{renderAnswerDetails()}</div>

                        {challenge.type === "sign_practice" && rubricCriteria.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Rúbrica</p>
                                {rubricCriteria.map((crit: any) => {
                                    const key = crit.id || crit.label
                                    return (
                                        <div key={key} className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold">{crit.label}</p>
                                                {crit.description && <p className="text-xs text-muted-foreground">{crit.description}</p>}
                                            </div>
                                            <Input
                                                type="number"
                                                className="w-32"
                                                value={rubricScoreInputs[key] ?? 0}
                                                onChange={(e) => setRubricScoreInputs((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                                            />
                                            <span className="text-xs text-muted-foreground">/ {crit.weight}</span>
                                        </div>
                                    )
                                })}
                                <p className="text-xs text-muted-foreground">Total otorgado: {awardedRubricPoints} / {challenge?.max_score || 100}</p>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setScore(String(awardedRubricPoints))}>
                                    Usar total de rúbrica como puntaje
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Estado</label>
                                <Select value={status} onValueChange={(val) => setStatus(val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendiente</SelectItem>
                                        <SelectItem value="approved">Aprobado</SelectItem>
                                        <SelectItem value="needs_revision">Requiere ajustes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Puntaje total</label>
                                <Input value={score} onChange={(e) => setScore(e.target.value)} placeholder="Ej. 90" />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Retroalimentación para el estudiante</label>
                            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeReview} disabled={savingReview}>Cancelar</Button>
                        <Button onClick={handleSaveReview} disabled={savingReview}>
                            {savingReview ? "Guardando..." : "Guardar revisión"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
