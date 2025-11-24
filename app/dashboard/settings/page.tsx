"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/supabase/auth-client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

interface LocalSettings {
    autoPublishClasses: boolean
    allowAutoEnrollment: boolean
    instantEvaluationScoring: boolean
    showDetailedFeedback: boolean
    emailNotifications: boolean
}

export default function DashboardSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [settings, setSettings] = useState<LocalSettings>({
        autoPublishClasses: false,
        allowAutoEnrollment: true,
        instantEvaluationScoring: true,
        showDetailedFeedback: false,
        emailNotifications: true,
    })
    const [saving, setSaving] = useState(false)
    const [savedAt, setSavedAt] = useState<Date | null>(null)

    useEffect(() => {
        async function load() {
            const currentUser = await getCurrentUser()
            setUser(currentUser)
            setLoading(false)
            // Placeholder: real settings fetch would go here.
        }
        load()
    }, [])

    function toggle<K extends keyof LocalSettings>(key: K) {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSave() {
        setSaving(true)
        try {
            // Placeholder save logic. Integrate with Supabase table (e.g. teacher_settings) later.
            await new Promise(r => setTimeout(r, 500))
            setSavedAt(new Date())
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-6 text-sm text-muted-foreground">Cargando configuración…</div>
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configuración</h1>
                <p className="text-muted-foreground mt-1 text-sm">Preferencias personales y ajustes por defecto para clases y evaluaciones.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>General</CardTitle>
                        <CardDescription>Opciones de notificación y comportamiento global.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Notificaciones por correo</p>
                                <p className="text-xs text-muted-foreground">Recibir avisos de nuevas inscripciones o evaluaciones.</p>
                            </div>
                            <Switch checked={settings.emailNotifications} onCheckedChange={() => toggle('emailNotifications')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Inscripción automática</p>
                                <p className="text-xs text-muted-foreground">Permitir que estudiantes se unan sin aprobación manual.</p>
                            </div>
                            <Switch checked={settings.allowAutoEnrollment} onCheckedChange={() => toggle('allowAutoEnrollment')} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Clases</CardTitle>
                        <CardDescription>Comportamiento predeterminado al crear nuevas clases.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Publicar automáticamente</p>
                                <p className="text-xs text-muted-foreground">Las nuevas clases se marcan como activas al crearse.</p>
                            </div>
                            <Switch checked={settings.autoPublishClasses} onCheckedChange={() => toggle('autoPublishClasses')} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Evaluaciones</CardTitle>
                        <CardDescription>Ajustes de feedback y calificación.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Calificación inmediata</p>
                                <p className="text-xs text-muted-foreground">Mostrar la puntuación apenas el estudiante envía la evaluación.</p>
                            </div>
                            <Switch checked={settings.instantEvaluationScoring} onCheckedChange={() => toggle('instantEvaluationScoring')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">Feedback detallado</p>
                                <p className="text-xs text-muted-foreground">Incluir explicaciones y soluciones tras enviar.</p>
                            </div>
                            <Switch checked={settings.showDetailedFeedback} onCheckedChange={() => toggle('showDetailedFeedback')} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
                {savedAt && (
                    <span className="text-xs text-muted-foreground">Guardado {savedAt.toLocaleTimeString()}</span>
                )}
            </div>
        </div>
    )
}
