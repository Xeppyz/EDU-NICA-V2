"use client"

import React, { useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"

interface EvalItem {
    id: string
    title: string
    due_at?: string | null
}

interface ActivityItem {
    id: string
    title: string
    lesson_id?: string
}

interface Props {
    evaluations: EvalItem[]
    activities?: ActivityItem[]
    pendingActivityIds?: string[] // optional list of activity ids considered pending (kept for backwards compatibility)
    pendingEvaluationIds?: string[] // optional list of evaluation ids considered pending
    onSelectDate?: (date: Date) => void
}

export default function PendingEvaluationsCalendar({ evaluations, activities = [], pendingActivityIds = [], pendingEvaluationIds = [], onSelectDate }: Props) {
    const [selected, setSelected] = useState<Date | undefined>(undefined)

    const pendingDates = useMemo(() => {
        // If a list of pendingEvaluationIds is provided, only highlight those evaluation due dates.
        if (pendingEvaluationIds && pendingEvaluationIds.length > 0) {
            const set = new Set(pendingEvaluationIds)
            return evaluations
                .filter((e) => set.has(e.id) && e.due_at)
                .map((e) => new Date(e.due_at as string))
        }

        return evaluations
            .map((e) => (e.due_at ? new Date(e.due_at as string) : null))
            .filter((d): d is Date => !!d)
    }, [evaluations, pendingEvaluationIds])

    const evaluationsOnSelected = useMemo(() => {
        if (!selected) return [] as EvalItem[]

        // Build base list of evaluations due that day
        const dueThatDay = evaluations.filter((e) => {
            if (!e.due_at) return false
            const d = new Date(e.due_at as string)
            return d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth() && d.getDate() === selected.getDate()
        })

        // If pendingEvaluationIds provided, filter to only pending ones
        if (pendingEvaluationIds && pendingEvaluationIds.length > 0) {
            const set = new Set(pendingEvaluationIds)
            return dueThatDay.filter((e) => set.has(e.id))
        }

        return dueThatDay
    }, [evaluations, selected, pendingEvaluationIds])

    const pendingActivities = useMemo(() => {
        // If caller provided pendingActivityIds, use it; otherwise consider all activities as pending
        const pendingSet = new Set(pendingActivityIds)
        return activities.filter((a) => (pendingActivityIds.length ? pendingSet.has(a.id) : true))
    }, [activities, pendingActivityIds])

    const pendingEvaluations = useMemo(() => {
        if (!pendingEvaluationIds || pendingEvaluationIds.length === 0) return [] as EvalItem[]
        const set = new Set(pendingEvaluationIds)
        return evaluations.filter((e) => set.has(e.id))
    }, [evaluations, pendingEvaluationIds])

    return (
        <div className="p-3 border rounded-lg max-w-full overflow-hidden">
            <h3 className="text-sm font-medium mb-2">Calendario</h3>
            <div className="w-full max-w-full">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(date) => {
                        setSelected(date || undefined)
                        if (date && onSelectDate) onSelectDate(date)
                    }}
                    modifiers={{ highlighted: pendingDates }}
                    // mark days that have pending deadlines — brighter accent color for visibility
                    modifiersClassNames={{ highlighted: "bg-amber-200 border-amber-500 text-amber-900" }}
                    classNames={{ root: 'w-full' }}
                />
            </div>

            <div className="mt-3">
                <h4 className="text-sm font-medium">Evaluaciones {selected ? `para ${selected.toLocaleDateString()}` : "próximas"}</h4>
                {selected ? (
                    evaluationsOnSelected.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                            {evaluationsOnSelected.map((e) => (
                                <li key={e.id} className="p-2 border rounded truncate">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm truncate">{e.title}</span>
                                        {e.due_at && (
                                            <span className="text-xs text-muted-foreground ml-2">{new Date(e.due_at).toLocaleString()}</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-2">No hay evaluaciones pendientes con vencimiento ese día.</p>
                    )
                ) : (
                    <p className="text-sm text-muted-foreground mt-2">Selecciona una fecha para ver evaluaciones en esa fecha.</p>
                )}
            </div>

            <div className="mt-3">
                <h4 className="text-sm font-medium">Evaluaciones pendientes</h4>
                {pendingEvaluations.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                        {pendingEvaluations.map((e) => (
                            <li key={e.id} className="p-2 border rounded truncate">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm truncate">{e.title}</span>
                                    {e.due_at && (
                                        <span className="text-xs text-muted-foreground ml-2">{new Date(e.due_at).toLocaleString()}</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground mt-2">No hay evaluaciones pendientes.</p>
                )}
            </div>
        </div>
    )
}
