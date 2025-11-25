import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type SendCredentialsPayload = {
    email: string
    password: string
    fullName?: string | null
    role?: string | null
}

const DEFAULT_FUNCTION_NAME = "send-credentials-email"

export async function sendCredentialsEmail(
    payload: SendCredentialsPayload,
    client?: SupabaseClient,
) {
    const supabase = client ?? (await getSupabaseServerClient())
    const functionName = process.env.SUPABASE_EMAIL_FUNCTION_NAME || DEFAULT_FUNCTION_NAME

    if (!functionName) throw new Error("Supabase email function name is not configured")
    if (!payload.email) throw new Error("Missing recipient email")
    if (!payload.password) throw new Error("Missing temporary password")

    const displayName = payload.fullName?.trim() || payload.email
    const subject = "Tus accesos a EDU-NICA"
    const text = `Hola ${displayName},\n\nSe creó una cuenta para vos en EDU-NICA.${payload.role ? ` Rol asignado: ${payload.role}.` : ""}\n\nCredenciales:\nUsuario: ${payload.email}\nContraseña temporal: ${payload.password}\n\nPor seguridad, iniciá sesión y actualizá la contraseña cuanto antes.\n\nEquipo EDU-NICA`
    const html = `
    <p>Hola <strong>${displayName}</strong>,</p>
    <p>Se creó una cuenta para vos en <strong>EDU-NICA</strong>${payload.role ? ` con rol <strong>${payload.role}</strong>` : ""}.</p>
    <p>Estos son tus accesos temporales:</p>
    <ul>
      <li><strong>Usuario:</strong> ${payload.email}</li>
      <li><strong>Contraseña:</strong> ${payload.password}</li>
    </ul>
    <p>Iniciá sesión y cambiá la contraseña cuanto antes para mantener tu cuenta segura.</p>
    <p>Equipo EDU-NICA</p>
  `

    const { error } = await supabase.functions.invoke(functionName, {
        body: {
            to: payload.email,
            subject,
            text,
            html,
        },
    })

    if (error) {
        throw new Error(error.message || "No se pudo enviar el correo de bienvenida")
    }
}
