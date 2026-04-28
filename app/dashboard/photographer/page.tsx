"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Plus, User, MessageSquare, Calendar } from "lucide-react"
import Image from "next/image"

export default function PhotographerDashboard() {
  const { user } = useStore()
  const isVerified = user?.verificationStatus === "verified"

  return (
    <DashboardLayout role="photographer">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-neutral-500">
          {isVerified 
            ? "Your profile is verified. You can now post gigs and find models."
            : "Complete verification to unlock gig posting features."
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
          <span className="text-xs uppercase tracking-wider">Post Shoot Gig</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <User className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Find Models</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <Calendar className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Bookings</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Messages</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Portfolio Grid */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Portfolio
              </CardTitle>
              <Button variant="outline" size="sm" className="rounded-none">
                Add Photos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop",
                  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=500&fit=crop",
                  "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=500&fit=crop",
                  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop",
                  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop",
                  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=500&fit=crop",
                ].map((img, i) => (
                  <div key={i} className="relative aspect-[4/5] group">
                    <Image
                      src={img}
                      alt={`Portfolio ${i + 1}`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm">View</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Find Models */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Find Models</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Sofia Laurent", type: "Fashion Model", location: "Paris" },
                { name: "Marcus Chen", type: "Commercial Model", location: "NYC" },
                { name: "Elena Moreau", type: "Runway Model", location: "Milan" },
              ].map((model, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{model.name}</h3>
                    <p className="text-xs text-neutral-500">{model.type}</p>
                    <p className="text-xs text-neutral-400">{model.location}</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-none text-xs">
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Shoots */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming Shoots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { client: "Luxe Brand Co", date: "Tomorrow, 10 AM", type: "Campaign" },
                { client: "Vogue Editorial", date: "May 15, 2 PM", type: "Editorial" },
              ].map((shoot, i) => (
                <div key={i} className="p-3 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-medium text-sm">{shoot.client}</h3>
                  <p className="text-xs text-neutral-500">{shoot.type}</p>
                  <p className="text-xs text-primary">{shoot.date}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
