"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/ui/theme-toggle"
import { Save, Shield, Wrench, Cog, Users } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminSettingsPage() {
    const router = useRouter()
    const [autoArchive, setAutoArchive] = useState(false)
    const [enforceStrongPasswords, setEnforceStrongPasswords] = useState(true)
    const [maxLoginAttempts, setMaxLoginAttempts] = useState(5)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)
        try {
            // Placeholder: Implement persistence (e.g. save to a settings table or KV store)
            await new Promise(r => setTimeout(r, 600))
            setMessage("Configuraciones guardadas correctamente.")
        } catch (err: any) {
            setMessage(err?.message || "Error al guardar configuraciones.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold flex items-center gap-2"><Cog className="w-5 h-5 text-primary" /> Opciones</h1>
                <p className="text-sm text-muted-foreground">Administra ajustes globales de la plataforma. (Esta página es base y puede ampliarse según necesidades futuras.)</p>
            </div>

            <form onSubmit={handleSave} className="space-y-10">
                <Card className="border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Wrench className="w-4 h-4 text-primary" /> General</CardTitle>
                        <CardDescription className="text-xs">Parámetros de funcionamiento generales.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start justify-between gap-6 py-2">
                            <div className="space-y-1">
                                <Label htmlFor="autoArchive">Archivado automático</Label>
                                <p className="text-xs text-muted-foreground max-w-xs">Archiva recursos antiguos automáticamente tras 90 días sin uso.</p>
                            </div>
                            <Switch id="autoArchive" checked={autoArchive} onCheckedChange={setAutoArchive} />
                        </div>
                        <Separator />
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="maxLoginAttempts">Intentos máximos de login</Label>
                                <Input id="maxLoginAttempts" type="number" min={1} max={20} value={maxLoginAttempts} onChange={e => setMaxLoginAttempts(Number(e.target.value))} />
                                <p className="text-xs text-muted-foreground">Bloquea temporalmente después de superar este número.</p>
                            </div>
                            <div className="space-y-1">
                                <Label>Tema</Label>
                                <div className="flex items-center gap-3 rounded-md border p-3">
                                    <ThemeToggle />
                                    <p className="text-xs text-muted-foreground">Alterna entre claro / oscuro.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4 text-primary" /> Seguridad</CardTitle>
                        <CardDescription className="text-xs">Políticas y controles de seguridad.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start justify-between gap-6 py-2">
                            <div className="space-y-1">
                                <Label htmlFor="strongPassword">Forzar contraseñas seguras</Label>
                                <p className="text-xs text-muted-foreground max-w-xs">Requiere mínimo 8 caracteres, mayúscula, número y símbolo.</p>
                            </div>
                            <Switch id="strongPassword" checked={enforceStrongPasswords} onCheckedChange={setEnforceStrongPasswords} />
                        </div>
                        <Separator />
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <p>Próximas opciones sugeridas:</p>
                            <ul className="list-disc ml-5 space-y-1">
                                <li>Activar 2FA para cuentas docentes</li>
                                <li>Rotación periódica de contraseñas</li>
                                <li>Reporte de actividad sospechosa</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4 text-primary" /> Gestión de Usuarios</CardTitle>
                        <CardDescription className="text-xs">Accesos rápidos a acciones administrativas.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <Button type="button" variant="outline" onClick={() => router.push('/admin/create')}>Crear usuario</Button>
                        <Button type="button" variant="outline" onClick={() => router.push('/admin/teachers')}>Ver docentes</Button>
                        <Button type="button" variant="outline" onClick={() => router.push('/admin/students')}>Ver estudiantes</Button>
                    </CardContent>
                </Card>

                {message && (
                    <div className="text-sm rounded-md border p-3 flex items-start gap-2 bg-muted/40">
                        <span className="font-medium">Estado:</span> <span>{message}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-3">
                    <Button type="submit" disabled={saving}>
                        {saving ? (
                            <span className="flex items-center gap-2"><Save className="w-4 h-4 animate-pulse" /> Guardando...</span>
                        ) : (
                            <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Guardar cambios</span>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
