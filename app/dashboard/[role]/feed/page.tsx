"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FeedView } from "@/components/feed-view"

export default function FeedPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role} showRail={true}>
      <FeedView />
    </DashboardLayout>
  )
}
