"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FeedView } from "@/components/feed-view"

export default function FeedPage() {
  const params = useParams()
  const role = params.role as string

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
