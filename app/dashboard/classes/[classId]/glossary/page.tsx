"use client"

import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import ManageGlossary from "@/components/teacher/manage-glossary"

export default function TeacherGlossaryPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">Glosario de la Clase</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona términos con interpretación en Lengua de Señas Nicaragüense
        </p>
      </div>

      <ManageGlossary classId={classId} />
    </div>
  )
}
