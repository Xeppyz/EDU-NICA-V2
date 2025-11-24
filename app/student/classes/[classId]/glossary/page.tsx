"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/auth-client"
import { getSupabaseClient } from "@/lib/supabase/client"
import { toEmbedUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Volume2, Video, Search, BookOpen, Tag, Bookmark, BookmarkCheck, Loader2, Hand } from "lucide-react"

interface GlossaryEntry {
  id: string
  term: string
  definition: string
  audio_url: string | null
  lsn_video_url: string | null
  lsn_video_storage_path: string | null
  category: string | null
  example_sentence: string | null
  handshape: string | null
  difficulty: string | null
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
  const [categoryFilter, setCategoryFilter] = useState<string>("todos")
  const [favorites, setFavorites] = useState<string[]>([])
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})
  const [signUrlLoading, setSignUrlLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    async function loadGlossary() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push("/auth/login")
          return
        }

        if (!classId || classId === "undefined") {
          console.warn("Invalid classId when loading glossary:", classId)
          setError("ID de clase inválido. Asegúrate de entrar desde la vista de la clase.")
          setEntries([])
          setLoading(false)
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
          console.error("Supabase error loading glossary:", supaError)
          setError(supaError.message || String(supaError))
          setEntries([])
        } else {
          setEntries(data || [])
        }
      } catch (err) {
        console.error("Error loading glossary:", err)
        setError((err as any)?.message || String(err))
      } finally {
        setLoading(false)
      }
    }

    loadGlossary()
  }, [classId, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem("glossaryFavorites")
      if (stored) {
        setFavorites(JSON.parse(stored) as string[])
      }
    } catch (e) {
      console.warn("Error loading glossary favorites", e)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem("glossaryFavorites", JSON.stringify(favorites))
  }, [favorites, hydrated])

  const categories = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.category).filter((cat): cat is string => !!cat))),
    [entries],
  )

  const filteredEntries = useMemo(() => {
    return entries
      .filter(
        (entry) =>
          entry.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.definition.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .filter((entry) => (categoryFilter === "todos" ? true : entry.category === categoryFilter))
      .sort((a, b) => {
        const aFav = favorites.includes(a.id)
        const bFav = favorites.includes(b.id)
        if (aFav === bFav) return a.term.localeCompare(b.term)
        return aFav ? -1 : 1
      })
  }, [entries, searchTerm, categoryFilter, favorites])

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedEntry(null)
      return
    }

    if (!selectedEntry || !filteredEntries.some((entry) => entry.id === selectedEntry.id)) {
      setSelectedEntry(filteredEntries[0])
    }
  }, [filteredEntries, selectedEntry])

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!selectedEntry?.lsn_video_storage_path) return
      if (videoUrls[selectedEntry.id]) return
      try {
        setSignUrlLoading(true)
        const resp = await fetch("/api/library/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: selectedEntry.lsn_video_storage_path, expires: 60 * 60 }),
        })
        const data = await resp.json()
        if (data?.signedURL) {
          setVideoUrls((prev) => ({ ...prev, [selectedEntry.id]: data.signedURL }))
        }
      } catch (err) {
        console.error("Error generating signed URL", err)
      } finally {
        setSignUrlLoading(false)
      }
    }

    fetchSignedUrl()
  }, [selectedEntry, videoUrls])

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]))
  }

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
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Términos ({filteredEntries.length})</CardTitle>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant={categoryFilter === "todos" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter("todos")}
                  >
                    Todos
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={categoryFilter === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryFilter(cat)}
                      className="flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" />
                      {cat}
                    </Button>
                  ))}
                </div>
              )}
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
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${selectedEntry?.id === entry.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                    >
                      <p className="font-medium text-sm line-clamp-1">{entry.term}</p>
                      <div className="flex text-xs text-muted-foreground gap-2">
                        {entry.category && <span>{entry.category}</span>}
                        {favorites.includes(entry.id) && <span>★</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedEntry ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedEntry.term}</CardTitle>
                <CardDescription>Definición y recursos multimedia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Definición</h3>
                  <p className="text-muted-foreground leading-relaxed">{selectedEntry.definition}</p>
                </div>

                {selectedEntry.example_sentence && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Ejemplo en contexto</h3>
                    <p className="text-sm text-muted-foreground italic">“{selectedEntry.example_sentence}”</p>
                  </div>
                )}

                {selectedEntry.lsn_video_storage_path ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Interpretación en Lengua de Señas Nicaragüense</h3>
                    </div>
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      {signUrlLoading && !videoUrls[selectedEntry.id] ? (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : videoUrls[selectedEntry.id] ? (
                        <video controls className="w-full h-full object-cover" src={videoUrls[selectedEntry.id]}>
                          Tu navegador no soporta video.
                        </video>
                      ) : (
                        <p className="text-xs text-muted-foreground px-4 text-center">
                          No se pudo generar el video.
                        </p>
                      )}
                    </div>
                  </div>
                ) : selectedEntry.lsn_video_url ? (
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
                ) : null}

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

                <div className="flex gap-2 flex-wrap pt-4 border-t">
                  {selectedEntry.category && (
                    <Badge className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {selectedEntry.category}
                    </Badge>
                  )}
                  {selectedEntry.difficulty && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Nivel: {selectedEntry.difficulty}
                    </Badge>
                  )}
                  {selectedEntry.handshape && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Hand className="w-3 h-3" />
                      {selectedEntry.handshape}
                    </Badge>
                  )}
                  {selectedEntry.audio_url && (
                    <Badge className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      Con Audio
                    </Badge>
                  )}
                  {(selectedEntry.lsn_video_storage_path || selectedEntry.lsn_video_url) && (
                    <Badge className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Con LSN
                    </Badge>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant={favorites.includes(selectedEntry.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFavorite(selectedEntry.id)}
                    className="flex items-center gap-2"
                  >
                    {favorites.includes(selectedEntry.id) ? (
                      <BookmarkCheck className="w-4 h-4" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                    {favorites.includes(selectedEntry.id) ? "Guardado" : "Guardar para practicar"}
                  </Button>
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
