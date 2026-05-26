"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FeedView } from "@/components/feed-view"

export default function FeedPage() {
  return (
    <DashboardLayout showRail={true}>
      <FeedView />
    </DashboardLayout>
  )
}
