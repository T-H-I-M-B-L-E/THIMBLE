"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImageIcon, Briefcase, MessageSquare, Shield, Camera } from "lucide-react"
import Link from "next/link"

export default function ModelDashboard() {
  const { user, gigs, designPosts } = useStore()

  const isVerified = user?.verificationStatus === "verified"

  return (
    <DashboardLayout role="model">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-neutral-500">
          {isVerified 
            ? "Your profile is verified. You can now apply to gigs and post your portfolio."
            : "Complete verification to unlock all features and apply to gigs."
          }
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">12</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Portfolio Items</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">5</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Applications</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">3</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Messages</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">{isVerified ? "✓" : "—"}</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Status</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Portfolio Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium">Portfolio</CardTitle>
              <Button variant="outline" size="sm" className="rounded-none">
                <Camera className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-neutral-300" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Gigs */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium">Available Gigs</CardTitle>
              <Link href="/dashboard/model/gigs">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {gigs.slice(0, 3).map((gig) => (
                <div key={gig.id} className="flex items-start gap-4 p-3 border border-neutral-200 dark:border-neutral-800">
                  <img
                    src={gig.postedByAvatar}
                    alt={gig.postedBy}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{gig.title}</h3>
                    <p className="text-sm text-neutral-500">{gig.location} • {gig.payment}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!isVerified}
                    className="rounded-none"
                    title={!isVerified ? "Verification required" : ""}
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Safety Notice */}
          <Card className="rounded-none border-neutral-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-900 dark:text-amber-100">Safety First</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Always verify gig details before accepting. Never share personal financial information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages Preview */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Luxe Brand Co", msg: "Interested in your portfolio...", time: "2h" },
                { name: "Elena Designs", msg: "Can you send more photos?", time: "5h" },
              ].map((msg, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{msg.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{msg.msg}</p>
                  </div>
                  <span className="text-xs text-neutral-400">{msg.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
