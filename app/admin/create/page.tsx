"use client"
import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, UserPlus, Users } from "lucide-react"

export default function AdminCreateUserPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [role, setRole] = useState<"student" | "teacher" | "admin">("student")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/admin/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role, full_name: fullName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Error creating user")
            // redirect to teachers or students list depending on role
            if (role === "teacher") router.push("/admin/teachers")
            else if (role === "student") router.push("/admin/students")
            else router.push("/admin")
        } catch (err: any) {
            setError(err?.message || String(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="max-w-3xl mx-auto border shadow-sm">
            <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    <CardTitle className="text-xl">Crear usuario</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">Registrar nuevas cuentas para estudiantes, docentes o administradores. Completa la información y asigna el rol correspondiente.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="fullName" className="text-sm font-medium">Nombre completo</Label>
                            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María González" className="" />
                            <p className="text-xs text-muted-foreground">Este nombre se mostrará en listados y reportes.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" />
                            <p className="text-xs text-muted-foreground">Usado para iniciar sesión y recibir notificaciones.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role" className="text-sm font-medium">Rol</Label>
                            <Select value={role} onValueChange={(val: string) => setRole(val as any)}>
                                <SelectTrigger id="role" className="w-full">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="student">🎓 Estudiante</SelectItem>
                                    <SelectItem value="teacher">👨‍🏫 Docente</SelectItem>
                                    <SelectItem value="admin">🛡️ Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Determina permisos y vistas disponibles.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                            <div className="relative">
                                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    <span className="sr-only">Toggle password</span>
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, combina letras y números.</p>
                        </div>
                    </div>

                    <Separator className="" />

                    {error && (
                        <div className="p-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                            <span className="font-medium">Error:</span> <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creando...' : 'Crear usuario'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
