"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

interface Props {
    evaluation: any
    onSubmit: (payload: { answers: any; score: number }) => Promise<void> | void
}

export default function DragDropRenderer({ evaluation, onSubmit }: Props) {
    const data = evaluation?.questions || {}
    const dd = data.dragdrop || { items: [], targets: [], mapping: {} }
    const items = dd.items || []
    const targets = dd.targets || []
    const correctMapping: Record<string, string> = dd.mapping || {}

    // Helpful message when teacher didn't define items/targets correctly
    if (!items || items.length === 0 || !targets || targets.length === 0) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Esta evaluación de Drag & Drop aún no tiene ítems u objetivos definidos por el docente.</p>
                <pre className="p-2 bg-muted/10 rounded text-xs">{JSON.stringify(evaluation?.questions || {}, null, 2)}</pre>
            </div>
        )
    }

    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)

    const handleChange = (itemId: string, targetId: string) => {
        setMapping((prev) => {
            // enforce exclusivity: only one item per target
            const next: Record<string, string> = { ...prev }
            // remove any existing mapping that points to this target
            Object.keys(next).forEach((k) => {
                if (next[k] === targetId) delete next[k]
            })
            // assign this item to the target
            next[itemId] = targetId
            return next
        })
    }

    const computeScore = () => {
        if (items.length === 0) return 0
        let correct = 0
        items.forEach((it: any) => {
            const id = it.id
            if (mapping[id] && mapping[id] === correctMapping[id]) correct++
        })
        return Math.round((correct / items.length) * 100)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const score = computeScore()
            await onSubmit({ answers: mapping, score })
        } finally {
            setLoading(false)
        }
    }

    // Drag & Drop UI: items on the left (draggable), targets on the right (dropzones)
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="font-medium mb-2">Ítems</h4>
                    <div className="space-y-2">
                        {items.map((it: any, idx: number) => (
                            <div
                                key={it.id || idx}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer?.setData("text/plain", it.id)
                                    try { e.dataTransfer!.effectAllowed = "move" } catch { }
                                }}
                                className="p-3 border rounded bg-muted/5 text-sm break-words cursor-grab hover:shadow"
                                role="button"
                                aria-grabbed={false}
                            >
                                {it.label || it.id}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-medium mb-2">Objetivos (suelta aquí)</h4>
                    <div className="space-y-2">
                        {targets.map((t: any) => (
                            <TargetDropZone
                                key={t.id}
                                target={t}
                                mapping={mapping}
                                items={items}
                                onDropItem={(itemId: string) => handleChange(itemId, t.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Current mapping summary and controls */}
            <div className="mt-2">
                <h5 className="font-medium mb-1">Tus emparejamientos</h5>
                <div className="space-y-1 text-sm">
                    {items.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-2">
                            <div className="w-1/3">{it.label}</div>
                            <div className="flex-1 text-sm">
                                {mapping[it.id] ? (targets.find((tr: any) => tr.id === mapping[it.id])?.label || mapping[it.id]) : <span className="text-muted-foreground">(sin asignar)</span>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 justify-end mt-3">
                    <Button type="button" variant="outline" onClick={() => setMapping({})}>Limpiar respuestas</Button>
                    <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600">
                        {loading ? "Enviando..." : "Enviar"}
                    </Button>
                </div>
            </div>
        </form>
    )
}

// Small dropzone component to encapsulate drag-over state and visual feedback
function TargetDropZone({ target, mapping, onDropItem, items }: { target: any; mapping: Record<string, string>; onDropItem: (itemId: string) => void; items: any[] }) {
    const [over, setOver] = useState(false)

    const assignedKey = Object.keys(mapping).find((k) => mapping[k] === target.id)
    const assignedLabel = assignedKey ? (items.find((it) => it.id === assignedKey)?.label || assignedKey) : null

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                const itemId = e.dataTransfer?.getData("text/plain")
                if (itemId) onDropItem(itemId)
            }}
            className={`p-4 border rounded min-h-[56px] flex items-center justify-between ${over ? "border-primary bg-primary/5" : "bg-muted/5"}`}
        >
            <div className="font-medium">{target.label}</div>
            <div className="text-sm text-muted-foreground">{assignedLabel ? assignedLabel : `${Object.keys(mapping).filter(k => mapping[k] === target.id).length} asignado(s)`}</div>
        </div>
    )
}
