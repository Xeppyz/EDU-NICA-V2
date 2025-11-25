"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordPage() {
    const router = useRouter()
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        async function checkRecoverySession() {
            const supabase = getSupabaseClient()
            const { data } = await supabase.auth.getSession()
            if (!data.session) {
                setError("El enlace de restablecimiento no es válido o ya expiró.")
                return
            }
            setReady(true)
        }
        checkRecoverySession()
    }, [])

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
            setSuccess("Contraseña actualizada. Ahora puedes iniciar sesión con la nueva clave.")
            setTimeout(() => router.push("/auth/login"), 1500)
        } catch (err: any) {
            console.error("Reset password error", err)
            setError(err?.message || "No se pudo actualizar la contraseña.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Restablecer contraseña</CardTitle>
                    <CardDescription>Ingresa tu nueva contraseña para completar el proceso.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!ready && !error ? (
                        <p className="text-sm text-muted-foreground">Verificando enlace...</p>
                    ) : (
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
                                    disabled={!ready || saving}
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
                                    disabled={!ready || saving}
                                />
                            </div>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            {success && <p className="text-sm text-emerald-600">{success}</p>}
                            <Button type="submit" disabled={!ready || saving} className="w-full">
                                {saving ? "Guardando..." : "Actualizar contraseña"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
