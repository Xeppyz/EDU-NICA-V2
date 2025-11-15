"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

interface Props {
    data: any[]
    xKey?: string
    dataKey: string
    fill?: string
    height?: number
}

export default function ClientBarChart({ data, xKey = "name", dataKey, fill = "#8884d8", height = 250 }: Props) {
    return (
        <div style={{ width: "100%", height }}>
            <BarChart width={800} height={height} data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} />
                <YAxis />
                <Tooltip />
                <Bar dataKey={dataKey} fill={fill} />
            </BarChart>
        </div>
    )
}
