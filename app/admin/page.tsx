"use client"

import React, { useEffect, useState } from 'react'
import { ChartContainer } from '@/components/ui/chart'
import ClientBarChart from '@/components/admin/client-bar-chart'

type Metrics = {
    counts: { students: number; teachers: number }
    avgScore: number | null
    topStudents: any[]
    topTeachers: any[]
    totalResponses: number
    classesMetrics: any[]
    error?: string
}

export default function AdminIndexPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                setLoading(true)
                const res = await fetch('/api/admin/metrics')
                const json = await res.json()
                if (!res.ok) {
                    setFetchError(json?.error || 'Error obteniendo métricas')
                } else {
                    if (!json.counts || typeof json.counts.students === 'undefined') {
                        setFetchError('Respuesta incompleta de métricas (counts faltan)')
                    }
                    setMetrics(json)
                }
            } catch (e: any) {
                setFetchError(e?.message || String(e))
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold">Panel de administración</h1>
            <p className="mt-2 text-sm text-muted-foreground">Usa el menú para administrar docentes, estudiantes y crear usuarios.</p>

            {loading && (
                <div className="mt-6 text-sm text-muted-foreground">Cargando métricas…</div>
            )}

            {!loading && fetchError && (
                <div className="mt-6 p-4 border rounded bg-red-50 dark:bg-red-950/30 text-sm">
                    <p className="font-medium mb-1">Error al cargar métricas</p>
                    <p>{fetchError}</p>
                </div>
            )}

            {!loading && metrics && (
                <>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Docentes</h3>
                            <p className="text-sm text-muted-foreground">Ver y administrar cuentas de docentes.</p>
                            <div className="mt-3 text-2xl font-semibold">{metrics.counts.teachers ?? 0}</div>
                        </div>
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Estudiantes</h3>
                            <p className="text-sm text-muted-foreground">Ver y administrar cuentas de estudiantes.</p>
                            <div className="mt-3 text-2xl font-semibold">{metrics.counts.students ?? 0}</div>
                        </div>
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Respuestas / Puntuación</h3>
                            <p className="text-sm text-muted-foreground">Resumen rápido de evaluaciones.</p>
                            <div className="mt-3">
                                <div className="text-lg font-semibold">Avg score: {metrics.avgScore != null ? metrics.avgScore.toFixed(2) : '—'}</div>
                                <div className="text-sm text-muted-foreground">Total responses: {metrics.totalResponses ?? 0}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Top estudiantes (por promedio)</h3>
                            <ul className="mt-3 space-y-2">
                                {(metrics.topStudents || []).map((s: any) => (
                                    <li key={s.id} className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{s.user?.full_name || s.user?.email || s.id}</div>
                                            <div className="text-sm text-muted-foreground">{s.user?.email || '-'}</div>
                                        </div>
                                        <div className="font-semibold">{(s.avg ?? 0).toFixed(2)}</div>
                                    </li>
                                ))}
                                {metrics.topStudents?.length === 0 && (
                                    <li className="text-xs text-muted-foreground">Sin datos de estudiantes.</li>
                                )}
                            </ul>
                        </div>
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Top docentes (por alumnos inscritos)</h3>
                            <ul className="mt-3 space-y-2">
                                {(metrics.topTeachers || []).map((t: any) => (
                                    <li key={t.id} className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{t.user?.full_name || t.user?.email || t.id}</div>
                                            <div className="text-sm text-muted-foreground">{t.user?.email || '-'}</div>
                                        </div>
                                        <div className="font-semibold">{t.count}</div>
                                    </li>
                                ))}
                                {metrics.topTeachers?.length === 0 && (
                                    <li className="text-xs text-muted-foreground">Sin datos de docentes.</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Promedio de progreso por clase</h3>
                            <ChartContainer id="class-progress" config={{ progress: { color: '#06b6d4', label: 'Avg progress' } }}>
                                <ClientBarChart
                                    data={(metrics.classesMetrics || []).map((c: any) => ({ name: c.name, avg_progress: c.avg_progress || 0 })).sort((a: any, b: any) => b.avg_progress - a.avg_progress)}
                                    dataKey="avg_progress"
                                    fill="var(--color-progress)"
                                />
                            </ChartContainer>
                        </div>
                        <div className="p-4 border rounded">
                            <h3 className="font-medium">Matriculaciones por clase</h3>
                            <ChartContainer id="class-enrolls" config={{ enrolls: { color: '#10b981', label: 'Enrollments' } }}>
                                <ClientBarChart
                                    data={(metrics.classesMetrics || []).map((c: any) => ({ name: c.name, enrollments: c.enrollments || 0 })).sort((a: any, b: any) => b.enrollments - a.enrollments)}
                                    dataKey="enrollments"
                                    fill="var(--color-enrolls)"
                                />
                            </ChartContainer>
                        </div>
                    </div>
                </>
            )}

            {/* Debug raw JSON eliminado */}
        </div>
    )
}
