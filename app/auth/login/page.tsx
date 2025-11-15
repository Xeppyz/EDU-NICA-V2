"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import log from '../../../public/logo_edunica.png'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn, getCurrentUser } from "@/lib/supabase/auth-client"
import { demoUsers } from "@/lib/demo-users"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data, error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const current = await getCurrentUser()
      const role = current?.role || (data.user.user_metadata?.role as string) || "student"
      if (role === "admin") {
        router.push("/admin")
      } else if (role === "teacher") {
        router.push("/dashboard")
      } else {
        router.push("/student")
      }
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setLoading(true)
    setError("")
    const demoUser = demoUsers.find((u) => u.email === demoEmail)
    if (demoUser) {
      setEmail(demoUser.email)
      setPassword(demoUser.password)
      const { data, error: signInError } = await signIn(demoUser.email, demoUser.password)

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        const current = await getCurrentUser()
        const role = current?.role || (data.user.user_metadata?.role as string) || "student"
        if (role === "admin") {
          router.push("/admin")
        } else if (role === "teacher") {
          router.push("/dashboard")
        } else {
          router.push("/student")
        }
      }
    }
  }

  return (
    <div className="min-h-screen flex bg-white font-the-seasons">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-purple-50 to-purple-100 flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="mb-4 flex justify-center -mt-30">
            <Image src={log} alt="EDUNICA Logo" width={320} height={240} className="drop-shadow-lg" sizes="(min-width: 1024px) 320px, 200px" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2 -mt-20">EDUNICA</h1>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center text-white text-xs">
                ✓
              </div>
              <span className="text-gray-700 text-sm font-the-seasons">Educación inclusiva para sordos y oyentes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center text-white text-xs">
                ✓
              </div>
              <span className="text-gray-700 text-sm font-the-seasons">Soporte en Lengua de Señas Nicaragüeña</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center text-white text-xs">
                ✓
              </div>
              <span className="text-gray-700 text-sm font-the-seasons">Herramientas de aprendizaje interactivas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden mb-8 flex justify-center">
            <Image src={log} alt="EDUNICA Logo" width={200} height={200} className="drop-shadow-lg" sizes="(min-width: 1024px) 360px, 200px" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Bienvenido</h2>
            <p className="text-gray-600">Ingresa a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                disabled={loading}
                className="h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all"
              disabled={loading}
            >
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>


          <p className="text-sm text-gray-600 text-center mt-6">
            ¿No tienes cuenta?{" "}
            <a href="/auth/signup" className="text-purple-600 hover:text-purple-700 font-semibold">
              Regístrate aquí
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
