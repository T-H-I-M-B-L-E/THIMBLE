"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Grid3X3, Settings, Shield } from "lucide-react"
import Image from "next/image"
import { use } from "react"

export default function ProfilePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = use(params)
  const { user } = useStore()

  return (
    <DashboardLayout role={role}>
      {/* Profile Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <img
            src={user?.avatar}
            alt={user?.fullName}
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-light">{user?.fullName}</h1>
              {user?.verificationStatus === "verified" ? (
                <Badge variant="verified">Verified</Badge>
              ) : user?.verificationStatus === "pending" ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <Badge variant="outline">Unverified</Badge>
              )}
            </div>
            <p className="text-neutral-500 mb-1">@{user?.email?.split("@")[0]}</p>
            <p className="text-sm text-neutral-400 capitalize mb-4">{user?.role}</p>
            
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="rounded-none">
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              {user?.verificationStatus !== "verified" && (
                <Button size="sm" className="rounded-none bg-black text-white">
                  <Shield className="h-4 w-4 mr-2" />
                  Get Verified
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-light">24</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Posts</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-light">1.2K</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Followers</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-light">48</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Following</p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Grid */}
      <Card className="rounded-none border-neutral-200">
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="relative aspect-square bg-neutral-100 dark:bg-neutral-900">
                <Image
                  src={`https://images.unsplash.com/photo-${[
                    "1558171813-4c088753af8f",
                    "1509631179647-0177331693ae",
                    "1515886657613-9f3515b0c78f",
                    "1469334031218-e382a71b716b",
                    "1496747611176-843222e1e57c",
                    "1503342217505-b0a15ec3261c",
                    "1490481651871-ab68de25d43d",
                    "1485968579169-a6e9dc7c057c",
                    "1558618666-fcd25c85cd64",
                  ][i - 1]}?w=400&h=400&fit=crop`}
                  alt={`Portfolio ${i}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
