"use client"

import { use } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FeedView } from "@/components/feed-view"

export default function FeedPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = use(params)

  return (
    <DashboardLayout role={role}>
      <div className="mb-6">
        <h1 className="text-2xl font-light mb-2">Feed</h1>
        <p className="text-neutral-500">Discover the latest from the community</p>
      </div>
      <FeedView />
    </DashboardLayout>
  )
}
