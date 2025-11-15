"use client"

import React from "react"
import FillBlankRenderer from "./FillBlank"
import MatchingRenderer from "./Matching"
import DragDropRenderer from "./DragDrop"

type Evaluation = any

interface Props {
    evaluation: Evaluation
    onSubmit: (payload: { answers: any; score: number }) => Promise<void> | void
}

export default function EvaluationRenderer({ evaluation, onSubmit }: Props) {
    const rawType = (evaluation?.type || "quiz") as string
    const type = rawType.replace(/[-_]/g, "").toLowerCase()

    switch (type) {
        case "fillblank":
            return <FillBlankRenderer evaluation={evaluation} onSubmit={onSubmit} />
        case "matching":
            return <MatchingRenderer evaluation={evaluation} onSubmit={onSubmit} />
        case "dragdrop":
            return <DragDropRenderer evaluation={evaluation} onSubmit={onSubmit} />
        case "quiz":
        default:
            // Basic fallback: render the raw questions and a submit button.
            return (
                <div className="space-y-4">
                    <pre className="p-2 bg-muted/10 rounded text-xs">{JSON.stringify(evaluation?.questions || [], null, 2)}</pre>
                    <div className="flex justify-end">
                        <button
                            className="px-4 py-2 rounded bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                            onClick={() => onSubmit({ answers: {}, score: 0 })}
                        >
                            Enviar (fallback)
                        </button>
                    </div>
                </div>
            )
    }
}
