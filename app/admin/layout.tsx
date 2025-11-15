"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Users, UserPlus, LogOut, Settings } from "lucide-react"
import ThemeToggle from '@/components/ui/theme-toggle'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        async function checkAuth() {
            const currentUser = await getCurrentUser()
            if (!currentUser) {
                router.push("/auth/login")
            } else {
                // Only allow admin role here
                if (currentUser.role !== "admin") {
                    router.push("/")
                    return
                }
                setUser(currentUser)
            }
            setLoading(false)
        }
        checkAuth()
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        )
    }

    const handleLogout = async () => {
        const { getAuthClient } = await import("@/lib/supabase/auth-client")
        const supabase = getAuthClient()
        await supabase.auth.signOut()
        router.push("/auth/login")
    }

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        <span className="font-semibold text-sm">Admin</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Gestión</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive>
                                        <a href="/admin">
                                            <Users className="w-4 h-4" />
                                            <span>Resumen</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <a href="/admin/teachers">
                                            <UserPlus className="w-4 h-4" />
                                            <span>Docentes</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <a href="/admin/students">
                                            <UserPlus className="w-4 h-4" />
                                            <span>Estudiantes</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <a href="/admin/create">
                                            <UserPlus className="w-4 h-4" />
                                            <span>Crear Usuario</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Configuración</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <a href="/admin/settings">
                                            <Settings className="w-4 h-4" />
                                            <span>Opciones</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <div className="w-full">
                                            <ThemeToggle />
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start bg-transparent" size="sm">
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                    </Button>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <div className="flex items-center justify-between p-4 border-b">
                    <SidebarTrigger />
                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                </div>
                <main className="flex-1 overflow-auto">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    )
}
