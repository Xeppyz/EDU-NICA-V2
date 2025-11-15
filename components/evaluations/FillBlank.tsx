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
            {questions.map((q: any, i: number) => (
                <div key={q.id || i}>
                    <label className="block text-sm font-medium mb-1">{q.prompt}</label>
                    <Input value={answers[i]} onChange={(e) => handleChange(i, e.target.value)} />
                </div>
            ))}

            <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
                    {loading ? "Enviando..." : "Enviar"}
                </Button>
            </div>
        </form>
    )
}
