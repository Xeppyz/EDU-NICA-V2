"use client"
import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AdminCreateUserPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [role, setRole] = useState<"student" | "teacher" | "admin">("student")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Crear usuario</CardTitle>
                <CardDescription>Crear cuentas nuevas para estudiantes, docentes o administradores.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="col-span-1 md:col-span-2">
                        <Label htmlFor="fullName">Nombre completo</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María González" />
                    </div>

                    <div>
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" />
                    </div>

                    <div>
                        <Label htmlFor="role">Rol</Label>
                        <Select value={role} onValueChange={(val: string) => setRole(val as any)}>
                            <SelectTrigger id="role" className="w-full">
                                <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="student">Estudiante</SelectItem>
                                <SelectItem value="teacher">Docente</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="password">Contraseña</Label>
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>

                    {error && (
                        <div className="col-span-1 md:col-span-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
                    )}

                    <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2">
                        <Button variant="secondary" onClick={() => router.push('/admin')}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear usuario'}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
