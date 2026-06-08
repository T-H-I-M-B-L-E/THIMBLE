"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { FeedView } from "@/components/feed-view"
import { HowTo } from "@/components/how-to"

export default function FeedPage() {
  return (
    <DashboardLayout showRail={true}>
      <HowTo
        id="feed"
        steps={[
          { icon: "👋", title: "Welcome to THIMBLE", body: "Your feed shows posts from people you follow — designers, models, photographers, and brands all in one place." },
          { icon: "❤️", title: "Like & comment", body: "Tap the heart to like a post, or the speech bubble to leave a comment. Engagement helps great work get discovered." },
          { icon: "🔖", title: "Save for later", body: "Hit the bookmark icon on any post to save it to your profile for easy reference later." },
        ]}
      />
      <FeedView />
    </DashboardLayout>
  )
}
