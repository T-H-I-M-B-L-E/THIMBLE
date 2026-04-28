"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Bookmark, MessageSquare, TrendingUp } from "lucide-react"

export default function BrandDashboard() {
  const { user, gigs } = useStore()
  const isVerified = user?.verificationStatus === "verified"

  return (
    <DashboardLayout role="brand">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-neutral-500">
          {isVerified 
            ? "Your brand is verified. You can now post campaigns and discover talent."
            : "Complete verification to unlock campaign posting features."
          }
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button 
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-none bg-black text-white"
          disabled={!isVerified}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Post Campaign</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <Users className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Discover Talent</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <Bookmark className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Saved</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Messages</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Campaigns */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium">Active Campaigns</CardTitle>
              <Button 
                size="sm" 
                className="rounded-none bg-black text-white"
                disabled={!isVerified}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {gigs.slice(0, 3).map((gig) => (
                <div key={gig.id} className="p-4 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{gig.title}</h3>
                    <span className="text-sm font-medium text-green-600">{gig.payment}</span>
                  </div>
                  <p className="text-sm text-neutral-500 mb-3">{gig.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-neutral-400">
                      <span>{gig.location}</span>
                      <span>{gig.date}</span>
                    </div>
                    <span className="text-sm text-neutral-500">{gig.applications} applications</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Campaign Performance */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900">
                  <p className="text-2xl font-light">12</p>
                  <p className="text-xs text-neutral-500 uppercase">Total Campaigns</p>
                </div>
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900">
                  <p className="text-2xl font-light">48</p>
                  <p className="text-xs text-neutral-500 uppercase">Hires</p>
                </div>
                <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900">
                  <p className="text-2xl font-light">156</p>
                  <p className="text-xs text-neutral-500 uppercase">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Talent Discovery */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Discover Talent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Sofia Laurent", role: "Model", location: "Paris", match: "98%" },
                { name: "Marcus Chen", role: "Photographer", location: "NYC", match: "95%" },
                { name: "Elena Moreau", role: "Designer", location: "Milan", match: "92%" },
              ].map((talent, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{talent.name}</h3>
                    <p className="text-xs text-neutral-500">{talent.role} • {talent.location}</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium">{talent.match}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-none">
                View All Talent
              </Button>
            </CardContent>
          </Card>

          {/* Saved Creatives */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                Saved Creatives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Luna Designs", type: "Design Studio", saved: "2 days ago" },
                { name: "Studio Noir", type: "Photography", saved: "1 week ago" },
              ].map((creative, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{creative.name}</p>
                    <p className="text-xs text-neutral-500">{creative.type}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
