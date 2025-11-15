import type React from "react"

import Link from "next/link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, MessageSquare, Database } from "lucide-react"

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode
  // params can be a Promise in some Next.js setups; await it to be safe
  params: any
}) {
  const { classId } = await params

  return (
    <div className="p-6 space-y-4">
      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="lessons" asChild>
            <Link href={`/student/classes/${classId}`}>
              <span className="inline-flex items-center">
                <BookOpen className="w-4 h-4 mr-2" />
                Lecciones
              </span>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="glossary" asChild>
            <Link href={`/student/classes/${classId}/glossary`}>
              <span className="inline-flex items-center">
                <Database className="w-4 h-4 mr-2" />
                Glosario
              </span>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="forum" asChild>
            <Link href={`/student/classes/${classId}/forum`}>
              <span className="inline-flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Foro
              </span>
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {children}
    </div>
  )
}
