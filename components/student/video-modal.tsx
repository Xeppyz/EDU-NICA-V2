"use client"

import React from "react"
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function getYouTubeEmbed(url: string) {
    try {
        const u = new URL(url)
        if (u.hostname.includes('youtube.com')) {
            const v = u.searchParams.get('v')
            if (v) return `https://www.youtube-nocookie.com/embed/${v}?autoplay=1`
        }
        if (u.hostname === 'youtu.be') {
            const id = u.pathname.replace('/', '')
            if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
        }
    } catch (e) { }
    return null
}

export default function VideoModal({ url, title, trigger }: { url: string; title?: string; trigger?: React.ReactNode }) {
    const yt = getYouTubeEmbed(url)

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger ?? <Button variant="outline">Ver video</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-3xl w-full">
                <DialogTitle>{title || 'Video'}</DialogTitle>
                <DialogDescription />
                <div className="mt-4">
                    {yt ? (
                        <div className="aspect-video">
                            <iframe
                                title={title || 'video'}
                                src={yt}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        </div>
                    ) : (
                        <video controls className="w-full">
                            <source src={url} />
                            Tu navegador no soporta la reproducción de video.
                        </video>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
