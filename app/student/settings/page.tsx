"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const MIN_PASSWORD_LENGTH = 8

export default function StudentSettingsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        async function ensureStudent() {
            const currentUser = await getCurrentUser()
            if (!currentUser) {
                router.push("/auth/login")
                return
            }
            if (currentUser.role !== "student") {
                router.push("/dashboard")
                return
            }
            setLoading(false)
        }
        ensureStudent()
    }, [router])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
            return
        }
        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden.")
            return
        }

        try {
            setSaving(true)
            const supabase = getSupabaseClient()
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
            if (updateError) throw updateError
            setSuccess("Contraseña actualizada correctamente.")
            setNewPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            console.error("Error updating password", err)
            setError(err?.message || "No se pudo actualizar la contraseña.")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-sm text-muted-foreground">Cargando configuración...</p>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Configuración de la Cuenta</h1>
                <p className="text-muted-foreground">Actualiza tu contraseña para mantener tu cuenta segura.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cambiar contraseña</CardTitle>
                    <CardDescription>Introduce una nueva contraseña y confírmala.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nueva contraseña</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={MIN_PASSWORD_LENGTH}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={MIN_PASSWORD_LENGTH}
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        {success && <p className="text-sm text-emerald-600">{success}</p>}
                        <Button type="submit" disabled={saving}>
                            {saving ? "Guardando..." : "Actualizar contraseña"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
