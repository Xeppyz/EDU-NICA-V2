"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { toEmbedUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Volume2, Video, Search, BookOpen } from "lucide-react"

interface GlossaryEntry {
  id: string
  term: string
  definition: string
  audio_url: string | null
  lsn_video_url: string | null
}

export default function StudentGlossaryPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.classId as string

  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState("")
  const [selectedEntry, setSelectedEntry] = useState<GlossaryEntry | null>(null)

  useEffect(() => {
    async function loadGlossary() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }
        // Guard against missing/invalid classId (sometimes Next params may be undefined during hydration
        // or links might be built incorrectly producing the literal string "undefined")
        if (!classId || classId === "undefined") {
          console.warn("Invalid classId when loading glossary:", classId)
          setError("ID de clase inválido. Asegúrate de entrar desde la vista de la clase.")
          setEntries([])
          setLoading(false)
          // Redirect the user back to their classes overview after showing the message briefly
          setTimeout(() => {
            try {
              router.push("/student")
            } catch (e) {
              console.warn("Redirect failed:", e)
            }
          }, 1200)
          return
        }

        const supabase = getSupabaseClient()
        const { data, error: supaError } = await supabase
          .from("glossary")
          .select("*")
          .eq("class_id", classId)
          .order("term", { ascending: true })

        if (supaError) {
          // Show and log RLS or other Supabase errors
          console.error("Supabase error loading glossary:", supaError)
          setError(supaError.message || String(supaError))
          setEntries([])
        } else {
          setEntries(data || [])
        }
      } catch (error) {
        console.error("Error loading glossary:", error)
        setError((error as any)?.message || String(error))
      } finally {
        setLoading(false)
      }
    }

    loadGlossary()
  }, [classId, router])

  const filteredEntries = entries.filter(
    (e) =>
      e.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Cargando glosario...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">Error: {error}</div>
      )}
      <div>
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          ← Volver
        </Button>
        <h1 className="text-3xl font-bold">Glosario</h1>
        <p className="text-muted-foreground mt-1">
          Accede a definiciones con interpretación en Lengua de Señas Nicaragüense
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search and List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Términos ({filteredEntries.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin resultados</p>
                ) : (
                  filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${selectedEntry?.id === entry.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                        }`}
                    >
                      <p className="font-medium text-sm line-clamp-1">{entry.term}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.audio_url || entry.lsn_video_url ? "📻" : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2">
          {selectedEntry ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedEntry.term}</CardTitle>
                <CardDescription>Definición y recursos multimedia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Definition */}
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Definición</h3>
                  <p className="text-muted-foreground leading-relaxed">{selectedEntry.definition}</p>
                </div>

                {/* LSN Video */}
                {selectedEntry.lsn_video_url && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Interpretación en Lengua de Señas Nicaragüense</h3>
                    </div>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <iframe
                        width="100%"
                        height="100%"
                        src={toEmbedUrl(selectedEntry.lsn_video_url) || selectedEntry.lsn_video_url}
                        title={`${selectedEntry.term} en Lengua de Señas`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Audio */}
                {selectedEntry.audio_url && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Pronunciación</h3>
                    </div>
                    <audio controls className="w-full" src={selectedEntry.audio_url}>
                      Tu navegador no soporta audio.
                    </audio>
                  </div>
                )}

                {/* Resources Badge */}
                <div className="flex gap-2 flex-wrap pt-4 border-t">
                  {selectedEntry.audio_url && (
                    <Badge className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      Con Audio
                    </Badge>
                  )}
                  {selectedEntry.lsn_video_url && (
                    <Badge className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Con LSN
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Selecciona un término para ver su definición</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
