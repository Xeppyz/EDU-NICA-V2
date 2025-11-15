"use client"

import React from "react"
import Image from "next/image"
import log from '../../../public/logo_edunica.png'
import Link from "next/link"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-purple-50 to-purple-100 flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-8 flex justify-center">
            <Image src={log} alt="EDUNICA Logo" width={280} height={280} className="drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">EDUNICA</h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-8">
            Plataforma de Educación Digital Inclusiva para Nicaragua. Conectando a docentes y estudiantes en un espacio
            accesible y colaborativo.
          </p>
        </div>
      </div>

      {/* Right side - Message */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md text-center">
          <div className="md:hidden mb-8 flex justify-center">
            <Image src={log} alt="EDUNICA Logo" width={200} height={200} className="drop-shadow-lg" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Registro cerrado</h2>
          <p className="text-gray-600 mb-4">Las cuentas ya no se crean desde aquí. Pide a un administrador que cree tu cuenta.</p>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4 text-sm text-yellow-800">
            Si eres administrador, inicia sesión y ve a <Link href="/admin" className="font-medium text-yellow-900">Panel de administración</Link> para crear usuarios.
          </div>

          <div className="mt-4">
            <Link href="/auth/login" className="inline-block px-6 py-2 bg-purple-600 text-white rounded-md font-medium">Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
