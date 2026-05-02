"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImageIcon, Briefcase, MessageSquare, Shield, Camera, Upload, Palette, Factory, Users, Bookmark, TrendingUp, Plus } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"

export default function RoleDashboard() {
  const params = useParams()
  const role = params.role as string
  const { user, gigs, designPosts } = useStore()
  const isVerified = user?.verificationStatus === "verified"

  // Role-specific config
  const roleConfig = {
    model: {
      title: "Model",
      welcome: isVerified
        ? "Your profile is verified. You can now apply to gigs and post your portfolio."
        : "Complete verification to unlock all features and apply to gigs.",
      quickActions: [
        { icon: Camera, label: "Add Photos", disabled: false },
        { icon: Briefcase, label: "Find Gigs", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Users, label: "Network", disabled: false },
      ],
    },
    designer: {
      title: "Designer",
      welcome: isVerified
        ? "Your profile is verified. You can now post designs and find manufacturers."
        : "Complete verification to unlock posting features.",
      quickActions: [
        { icon: Upload, label: "Upload Design", disabled: !isVerified },
        { icon: Plus, label: "Post Gig", disabled: !isVerified },
        { icon: Factory, label: "Find Manufacturers", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
      ],
    },
    manufacturer: {
      title: "Manufacturer",
      welcome: isVerified
        ? "Your profile is verified. You can now post services and receive orders."
        : "Complete verification to unlock manufacturing features.",
      quickActions: [
        { icon: Plus, label: "Post Service", disabled: !isVerified },
        { icon: Palette, label: "Find Designs", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Bookmark, label: "Saved", disabled: false },
      ],
    },
    photographer: {
      title: "Photographer",
      welcome: isVerified
        ? "Your profile is verified. You can now showcase your work and find shoots."
        : "Complete verification to unlock all features.",
      quickActions: [
        { icon: Upload, label: "Upload Work", disabled: !isVerified },
        { icon: Briefcase, label: "Find Shoots", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
        { icon: Users, label: "Network", disabled: false },
      ],
    },
    brand: {
      title: "Brand",
      welcome: isVerified
        ? "Your brand is verified. You can now post campaigns and discover talent."
        : "Complete verification to unlock campaign posting features.",
      quickActions: [
        { icon: Plus, label: "Post Campaign", disabled: !isVerified },
        { icon: Users, label: "Discover Talent", disabled: false },
        { icon: Bookmark, label: "Saved", disabled: false },
        { icon: MessageSquare, label: "Messages", disabled: false },
      ],
    },
  }

  const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.model

  return (
    <DashboardLayout role={role}>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0] || "Creator"}
        </h1>
        <p className="text-neutral-500">{config.welcome}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {config.quickActions.map((action, i) => {
          const Icon = action.icon
          return (
            <Button
              key={i}
              className="h-auto py-4 flex flex-col items-center gap-2 rounded-none bg-black text-white"
              disabled={action.disabled}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider">{action.label}</span>
            </Button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolio/Designs Section */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {role === "model" ? "Portfolio" : role === "photographer" ? "Portfolio" : "Your Work"}
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

          {/* Available Gigs */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Available Gigs
              </CardTitle>
              <Link href={`/dashboard/${role}/gigs`}>
                <Button variant="ghost" size="sm" className="text-xs">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {gigs.slice(0, 3).map((gig) => (
                <div key={gig.id} className="flex items-center gap-4 p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={gig.postedByAvatar || "/placeholder-avatar.png"}
                      alt={gig.postedBy}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{gig.title}</h3>
                    <p className="text-xs text-neutral-500 truncate">{gig.location} • {gig.payment}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!isVerified}
                    className="rounded-none h-9 px-3 text-xs"
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

          {/* Discover/Network */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Discover Talent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Sofia Laurent", role: "Model", location: "Paris", match: "98%", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
                { name: "Marcus Chen", role: "Photographer", location: "NYC", match: "95%", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
                { name: "Elena Moreau", role: "Designer", location: "Milan", match: "92%", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
              ].map((talent, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={talent.avatar}
                      alt={talent.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{talent.name}</h3>
                    <p className="text-xs text-neutral-500">{talent.role} • {talent.location}</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium">{talent.match}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-none">
                View All
              </Button>
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
                { name: "Luxe Brand Co", msg: "Interested in your work...", time: "2h", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop" },
                { name: "Elena Designs", msg: "Can you send more photos?", time: "5h", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
              ].map((msg, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={msg.avatar}
                      alt={msg.name}
                      fill
                      className="object-cover"
                    />
                  </div>
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
