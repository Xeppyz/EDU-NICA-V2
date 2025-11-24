"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
    const [signVideoFile, setSignVideoFile] = useState<File | null>(null)
    const [signReflection, setSignReflection] = useState("")
    const [signSubmissionDuration, setSignSubmissionDuration] = useState("")
    const [signSubmissionTranscript, setSignSubmissionTranscript] = useState("")
    const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null)
    const [submissionVideoUrl, setSubmissionVideoUrl] = useState<string | null>(null)
    const [uploadingVideo, setUploadingVideo] = useState(false)
    const [recordingError, setRecordingError] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
    const liveVideoRef = useRef<HTMLVideoElement | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

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
                    if (data.type === "sign_practice" && data.reference_video_storage_path) {
                        try {
                            const res = await fetch("/api/library/signed-url", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ path: data.reference_video_storage_path, expires: 60 * 60 }),
                            })
                            const json = await res.json()
                            if (json?.signedURL) setReferenceVideoUrl(json.signedURL)
                        } catch (error) {
                            console.warn("No se pudo obtener el video de referencia", error)
                        }
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
                            if (data.type === "sign_practice") {
                                if (prev.answers?.notes) setSignReflection(prev.answers.notes)
                                if (prev.submission_transcript) setSignSubmissionTranscript(prev.submission_transcript)
                                if (prev.submission_duration_seconds) setSignSubmissionDuration(String(prev.submission_duration_seconds))
                                if (prev.submission_storage_path) {
                                    try {
                                        const res = await fetch("/api/library/signed-url", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ path: prev.submission_storage_path, expires: 60 * 60 }),
                                        })
                                        const json = await res.json()
                                        if (json?.signedURL) setSubmissionVideoUrl(json.signedURL)
                                    } catch (error) {
                                        console.warn("No se pudo obtener el video enviado", error)
                                    }
                                }
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

    useEffect(() => {
        return () => {
            cameraStream?.getTracks().forEach((track) => track.stop())
        }
    }, [cameraStream])

    useEffect(() => {
        return () => {
            if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl)
        }
    }, [recordedPreviewUrl])

    const sanitizeFilename = (name: string) =>
        name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")

    const rubricCriteria = useMemo(() => {
        if (!challenge?.rubric || !Array.isArray(challenge.rubric)) return []
        return challenge.rubric
    }, [challenge?.rubric])

    const startRecording = async () => {
        setRecordingError(null)
        setRecordedPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
        })
        try {
            if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
                setRecordingError("Tu navegador no permite grabar video aquí")
                return
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            setCameraStream(stream)
            if (liveVideoRef.current) {
                liveVideoRef.current.srcObject = stream
                liveVideoRef.current.muted = true
                await liveVideoRef.current.play().catch(() => { })
            }
            const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
            const chunks: BlobPart[] = []
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) chunks.push(event.data)
            }
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType })
                const url = URL.createObjectURL(blob)
                setRecordedPreviewUrl(url)
                const filename = `sign-${Date.now()}.webm`
                const recordedFile = new File([blob], filename, { type: blob.type || "video/webm" })
                setSignVideoFile(recordedFile)
                setCameraStream((prev) => {
                    prev?.getTracks().forEach((track) => track.stop())
                    return null
                })
                setIsRecording(false)
                mediaRecorderRef.current = null
            }
            mediaRecorderRef.current = recorder
            recorder.start()
            setIsRecording(true)
        } catch (err: any) {
            console.error("Error iniciando cámara", err)
            setRecordingError(err?.message || "No se pudo acceder a la cámara")
            setIsRecording(false)
        }
    }

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== "inactive") {
            recorder.stop()
        }
        setIsRecording(false)
    }

    const discardRecording = () => {
        setSignVideoFile(null)
        setRecordedPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
        })
    }

    const handleSubmit = async () => {
        if (!user) return router.push("/auth/login")
        if (!challenge) return

        // build answers based on type
        let answers: any = {}
        const payload = challenge.payload || {}
        let submissionStoragePath = existingResponse?.submission_storage_path || null
        let submissionDurationSeconds = existingResponse?.submission_duration_seconds || null
        let submissionTranscript = existingResponse?.submission_transcript || null

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
        } else if (challenge.type === "sign_practice") {
            if (!signVideoFile && !existingResponse?.submission_storage_path) {
                alert("Sube un video con tu seña para enviar el reto")
                return
            }
            if (signSubmissionDuration.trim()) {
                const parsed = Number(signSubmissionDuration)
                if (Number.isNaN(parsed) || parsed < 0) {
                    alert("La duración estimada debe ser un número positivo")
                    return
                }
                submissionDurationSeconds = Math.round(parsed)
            }
            submissionTranscript = signSubmissionTranscript.trim() || null
            answers = {
                notes: signReflection.trim(),
                version: existingResponse?.answers?.version ? existingResponse.answers.version + 1 : 1,
            }
            if (signVideoFile) {
                try {
                    setUploadingVideo(true)
                    const supabase = getSupabaseClient()
                    const extension = signVideoFile.name.split(".").pop()?.toLowerCase() || "mp4"
                    const rawBase = signVideoFile.name.substring(0, signVideoFile.name.lastIndexOf(".")) || signVideoFile.name
                    const safeBase = sanitizeFilename(rawBase)
                    const objectPath = `challenge-submissions/${challenge.id}/${user.id}-${Date.now()}-${safeBase}.${extension}`
                    const uploadResp = await supabase.storage.from("library").upload(objectPath, signVideoFile, {
                        upsert: true,
                        contentType: signVideoFile.type || "video/mp4",
                    })
                    if (uploadResp.error) throw uploadResp.error
                    submissionStoragePath = objectPath
                } catch (err: any) {
                    console.error("Error subiendo video:", err)
                    alert(err?.message || "No se pudo subir el video")
                    setUploadingVideo(false)
                    return
                } finally {
                    setUploadingVideo(false)
                }
            }
        }

        try {
            setSubmitting(true)
            const supabase = getSupabaseClient()
            const toInsert = {
                challenge_id: challenge.id,
                student_id: user.id,
                answers,
                completed_at: new Date().toISOString(),
                submission_storage_path: submissionStoragePath,
                submission_duration_seconds: submissionDurationSeconds,
                submission_transcript: submissionTranscript,
                review_status: challenge.type === "sign_practice" ? "pending" : undefined,
                reviewer_id: challenge.type === "sign_practice" ? null : undefined,
                reviewed_at: challenge.type === "sign_practice" ? null : undefined,
                rubric_scores: challenge.type === "sign_practice" ? null : undefined,
                teacher_feedback: challenge.type === "sign_practice" ? null : undefined,
                score: challenge.type === "sign_practice" ? null : undefined,
            }
            let data, error
            if (existingResponse) {
                const resp = await supabase.from("challenge_responses").update(toInsert).eq("id", existingResponse.id).select().single()
                data = resp.data
                error = resp.error
            } else {
                const resp = await supabase.from("challenge_responses").insert([toInsert]).select().single()
                data = resp.data
                error = resp.error
            }
            if (error) throw error
            setExistingResponse(data)
            if (challenge.type === "sign_practice" && data?.submission_storage_path) {
                try {
                    const res = await fetch("/api/library/signed-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ path: data.submission_storage_path, expires: 60 * 60 }),
                    })
                    const json = await res.json()
                    if (json?.signedURL) setSubmissionVideoUrl(json.signedURL)
                } catch (error) {
                    console.warn("No se pudo refrescar el video subido", error)
                }
            }
            setSignVideoFile(null)
            alert(existingResponse ? "Respuesta actualizada" : "Respuesta enviada. ¡Bien hecho!")
            if (challenge.type !== "sign_practice") router.push("/student")
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

                    {challenge.type === "sign_practice" && (
                        <div className="space-y-4">
                            <div>
                                <p className="font-medium">Indicaciones</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{payload.prompt}</p>
                            </div>
                            {payload.tips && (
                                <div>
                                    <p className="font-medium">Consejos</p>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{payload.tips}</p>
                                </div>
                            )}
                            {referenceVideoUrl ? (
                                <div>
                                    <p className="font-medium mb-2">Video de referencia</p>
                                    <video controls className="w-full max-w-xl rounded border" src={referenceVideoUrl} />
                                </div>
                            ) : challenge.reference_video_transcript ? (
                                <div>
                                    <p className="font-medium">Transcripción de referencia</p>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.reference_video_transcript}</p>
                                </div>
                            ) : null}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Carga tu video (MP4/Mov)</label>
                                    <Input type="file" accept="video/*" onChange={(e) => setSignVideoFile(e.target.files?.[0] || null)} />
                                    {signVideoFile && <p className="text-xs text-muted-foreground">Archivo listo: {signVideoFile.name}</p>}
                                </div>
                                <div className="space-y-2 border rounded-md p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium">Grabar con la cámara</p>
                                            <p className="text-xs text-muted-foreground">Usa tu cámara para grabar la seña sin salir de la plataforma.</p>
                                        </div>
                                        {isRecording ? (
                                            <Button size="sm" variant="destructive" type="button" onClick={stopRecording}>Detener</Button>
                                        ) : (
                                            <Button size="sm" type="button" onClick={startRecording}>Iniciar grabación</Button>
                                        )}
                                    </div>
                                    {recordingError && <p className="text-xs text-destructive">{recordingError}</p>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Vista previa en vivo</p>
                                            <video ref={liveVideoRef} className="w-full rounded border aspect-video bg-black" autoPlay muted playsInline />
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-muted-foreground mb-1">Tu grabación</p>
                                            {recordedPreviewUrl ? (
                                                <div className="space-y-2">
                                                    <video controls className="w-full rounded border" src={recordedPreviewUrl} />
                                                    <Button type="button" variant="secondary" size="sm" onClick={discardRecording}>Descartar grabación</Button>
                                                </div>
                                            ) : (
                                                <div className="aspect-video w-full rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                                    Aún no grabas nada
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {submissionVideoUrl && !recordedPreviewUrl && (
                                    <div className="mt-2">
                                        <p className="text-sm font-medium">Último envío</p>
                                        <video controls className="w-full max-w-xl rounded border" src={submissionVideoUrl} />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Duración estimada (segundos)</label>
                                    <Input type="number" min="0" value={signSubmissionDuration} onChange={(e) => setSignSubmissionDuration(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Transcripción / Glosa del envío (opcional)</label>
                                    <Textarea value={signSubmissionTranscript} onChange={(e) => setSignSubmissionTranscript(e.target.value)} rows={3} />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notas para la docente</label>
                                <Textarea value={signReflection} onChange={(e) => setSignReflection(e.target.value)} placeholder="Comparte cómo te sentiste grabando la seña" />
                            </div>
                            {rubricCriteria.length > 0 && (
                                <div>
                                    <p className="font-medium mb-1">Rúbrica</p>
                                    <div className="border rounded-md divide-y">
                                        {rubricCriteria.map((crit: any) => (
                                            <div key={crit.id || crit.label} className="p-2 flex justify-between gap-4">
                                                <div>
                                                    <p className="font-medium text-sm">{crit.label}</p>
                                                    {crit.description && <p className="text-xs text-muted-foreground">{crit.description}</p>}
                                                </div>
                                                <span className="text-sm font-semibold">{crit.weight} pts</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {existingResponse?.review_status && (
                                <div className="border rounded-md p-3 bg-muted/30">
                                    <p className="font-medium">Estado de revisión: <span className="capitalize">{existingResponse.review_status.replace("_", " ")}</span></p>
                                    {existingResponse.teacher_feedback && (
                                        <p className="text-sm mt-2">Retroalimentación: {existingResponse.teacher_feedback}</p>
                                    )}
                                    {existingResponse.rubric_scores && (
                                        <div className="mt-2 text-sm">
                                            {Object.entries(existingResponse.rubric_scores).map(([key, value]) => (
                                                <p key={key}>{key}: {Number(value) || 0} pts</p>
                                            ))}
                                        </div>
                                    )}
                                    {existingResponse.score !== null && existingResponse.score !== undefined && (
                                        <p className="text-sm mt-2 font-semibold">Puntaje asignado: {existingResponse.score}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-4 flex gap-2">
                        <Button onClick={() => router.back()} variant="outline">Volver</Button>
                        <Button onClick={handleSubmit} disabled={submitting || uploadingVideo}>
                            {uploadingVideo ? "Subiendo video..." : submitting ? "Guardando..." : existingResponse ? "Actualizar respuesta" : "Enviar respuesta"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
