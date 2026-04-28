"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Palette, Factory, MessageSquare, Plus } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function DesignerDashboard() {
  const { user, designPosts, gigs } = useStore()
  const isVerified = user?.verificationStatus === "verified"

  return (
    <DashboardLayout role="designer">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-neutral-500">
          {isVerified 
            ? "Your profile is verified. You can now post designs and find manufacturers."
            : "Complete verification to unlock posting features."
          }
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button 
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-none bg-black text-white"
          disabled={!isVerified}
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Upload Design</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-none"
          disabled={!isVerified}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Post Gig</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <Factory className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Find Manufacturers</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 rounded-none">
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Messages</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Design Feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Your Designs
              </CardTitle>
              <Button variant="outline" size="sm" className="rounded-none">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {designPosts.slice(0, 6).map((post) => (
                  <div key={post.id} className="relative aspect-[3/4] group">
                    <Image
                      src={post.image}
                      alt={post.description}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm">{post.likes} likes</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Find Manufacturers */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Find Manufacturers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Premium Textiles Ltd", specialty: "Silk & Cotton", location: "Italy" },
                { name: "EcoFabrics Co", specialty: "Sustainable Materials", location: "Portugal" },
                { name: "Atelier Productions", specialty: "Haute Couture", location: "France" },
              ].map((mfg, i) => (
                <div key={i} className="p-3 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-medium">{mfg.name}</h3>
                  <p className="text-sm text-neutral-500">{mfg.specialty}</p>
                  <p className="text-xs text-neutral-400">{mfg.location}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-none">
                View All Manufacturers
              </Button>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Premium Textiles", msg: "We can produce your design...", time: "1h" },
                { name: "Luxe Brand Co", msg: "Interested in collaboration", time: "3h" },
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
