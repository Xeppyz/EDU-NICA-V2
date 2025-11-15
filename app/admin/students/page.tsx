"use client"
import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminStudentsPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingUser, setEditingUser] = useState<any | null>(null)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    const [form, setForm] = useState({ email: "", full_name: "", password: "" })

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const res = await fetch("/api/admin/list-users?role=student")
                const data = await res.json()
                setUsers(data.users || [])
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    function openEdit(u: any) {
        setEditingUser(u)
        setForm({ email: u.email || "", full_name: u.user_metadata?.full_name || "", password: "" })
    }

    async function saveEdit() {
        if (!editingUser) return
        setSaving(true)
        try {
            const res = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingUser.id, email: form.email, full_name: form.full_name, password: form.password || undefined }),
            })
            const data = await res.json()
            if (res.ok) {
                // update local list
                setUsers((prev) => prev.map(u => u.id === editingUser.id ? { ...u, email: data.user?.email || form.email, user_metadata: { ...u.user_metadata, full_name: form.full_name } } : u))
                setEditingUser(null)
                setForm({ email: "", full_name: "", password: "" })
            } else {
                console.error(data)
                alert(data.error || 'Error al guardar')
            }
        } catch (e) {
            console.error(e)
            alert('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    async function doDelete(id: string) {
        if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
        setDeleting(id)
        try {
            const res = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await res.json()
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== id))
            } else {
                console.error(data)
                alert(data.error || 'Error al eliminar')
            }
        } catch (e) {
            console.error(e)
            alert('Error al eliminar')
        } finally {
            setDeleting(null)
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-lg font-semibold">Estudiantes</h1>
            {loading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (
                <div className="mt-4 space-y-2">
                    {users.length === 0 && <p className="text-sm text-muted-foreground">No hay estudiantes.</p>}
                    {users.map((u) => (
                        <div key={u.id} className="p-3 border rounded flex items-center justify-between">
                            <div>
                                <div className="font-medium">{u.email}</div>
                                <div className="text-sm text-muted-foreground">{u.user_metadata?.full_name || "-"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-muted-foreground mr-2">{u.user_metadata?.role}</div>
                                <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Editar</Button>
                                <Button size="sm" variant="destructive" onClick={() => doDelete(u.id)} disabled={deleting === u.id}>{deleting === u.id ? 'Eliminando...' : 'Eliminar'}</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar usuario</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div>
                            <Label>Email</Label>
                            <Input value={form.email} onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Nombre completo</Label>
                            <Input value={form.full_name} onChange={(e: any) => setForm(f => ({ ...f, full_name: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Contraseña (dejar en blanco para no cambiar)</Label>
                            <Input type="password" value={form.password} onChange={(e: any) => setForm(f => ({ ...f, password: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                        <Button onClick={saveEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
