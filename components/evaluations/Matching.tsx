"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

interface Props {
    evaluation: any
    onSubmit: (payload: { answers: any; score: number }) => Promise<void> | void
}

export default function MatchingRenderer({ evaluation, onSubmit }: Props) {
    const data = evaluation?.questions || { pairs: [] }
    const pairs = Array.isArray(data) ? data : data.pairs || []
    const left = pairs.map((p: any) => ({ id: p.id || p.leftId, text: p.left }))
    const right = pairs.map((p: any) => ({ id: p.id || p.rightId, text: p.right }))

    const [matches, setMatches] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)

    const handleChange = (leftId: string, rightId: string) => {
        setMatches((prev) => ({ ...prev, [leftId]: rightId }))
    }

    const computeScore = () => {
        if (pairs.length === 0) return 0
        let correct = 0
        pairs.forEach((p: any) => {
            const leftId = p.id || p.leftId
            const correctRightId = p.rightId || p.id
            if (matches[leftId] && matches[leftId] === (p.rightId || p.id || p.right)) correct++
        })
        return Math.round((correct / pairs.length) * 100)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const score = computeScore()
            await onSubmit({ answers: matches, score })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {left.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3">
                    <div className="w-1/3">{l.text}</div>
                    <div className="flex-1">
                        <Select value={matches[l.id] || ""} onValueChange={(v: any) => handleChange(l.id, v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent>
                                {right.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.text}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
