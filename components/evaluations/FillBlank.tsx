"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
    evaluation: any
    onSubmit: (payload: { answers: any; score: number }) => Promise<void> | void
}

export default function FillBlankRenderer({ evaluation, onSubmit }: Props) {
    const questions = evaluation?.questions || []
    const [answers, setAnswers] = useState<string[]>(questions.map(() => ""))
    const [loading, setLoading] = useState(false)

    const getImageSrc = (q: any) => {
        if (typeof q?.imageUrl === "string" && q.imageUrl.trim()) return q.imageUrl
        const storagePath = q?.imageStoragePath || q?.image_storage_path
        return storagePath ? `/api/library/object?path=${encodeURIComponent(storagePath)}` : null
    }

    const handleChange = (idx: number, value: string) => {
        setAnswers((prev) => {
            const next = [...prev]
            next[idx] = value
            return next
        })
    }

    const computeScore = () => {
        if (questions.length === 0) return 0
        let correct = 0
        questions.forEach((q: any, i: number) => {
            const expected = (q.blanks && q.blanks[0]) || q.answer || ""
            if (String(expected).trim().toLowerCase() === String(answers[i] || "").trim().toLowerCase()) correct++
        })
        return Math.round((correct / questions.length) * 100)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const score = computeScore()
            await onSubmit({ answers, score })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {questions.map((q: any, i: number) => {
                const imageSrc = getImageSrc(q)
                return (
                    <div key={q.id || i} className="space-y-2">
                        <label className="block text-sm font-medium">{q.prompt}</label>
                        {imageSrc && <img src={imageSrc} alt={q.prompt || `Entrada ${i + 1}`} className="w-full rounded-md object-cover max-h-64" />}
                        <Input value={answers[i]} onChange={(e) => handleChange(i, e.target.value)} placeholder="Escribe tu respuesta" />
                    </div>
                )
            })}

            <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
                    {loading ? "Enviando..." : "Enviar"}
                </Button>
            </div>
        </form>
    )
}
