"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Package, MessageSquare, TrendingUp } from "lucide-react"
import Image from "next/image"

export default function ManufacturerDashboard() {
  const { user } = useStore()
  const isVerified = user?.verificationStatus === "verified"

  return (
    <DashboardLayout role="manufacturer">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-light mb-2">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-neutral-500">
          {isVerified 
            ? "Your profile is verified. You can now receive production requests."
            : "Complete verification to unlock incoming requests."
          }
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">24</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Requests</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">8</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Active Orders</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">$45K</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Revenue</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200">
          <CardContent className="p-4">
            <p className="text-2xl font-light">4.9</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Rating</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Services Card */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Services & Pricing
              </CardTitle>
              <Button variant="outline" size="sm" className="rounded-none">
                Edit Services
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { service: "Small Batch Production (50-100 units)", price: "$25/unit" },
                { service: "Medium Batch (100-500 units)", price: "$20/unit" },
                { service: "Large Batch (500+ units)", price: "$15/unit" },
                { service: "Pattern Making", price: "$150/design" },
                { service: "Sample Development", price: "$200/sample" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm">{item.service}</span>
                  <span className="font-medium">{item.price}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Incoming Requests */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Incoming Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { designer: "Elena Moreau", project: "Summer Dress Collection", quantity: "200 units", deadline: "2 weeks", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
                { designer: "Marcus Studio", project: "Streetwear Line", quantity: "500 units", deadline: "1 month", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
                { designer: "Luna Designs", project: "Evening Gowns", quantity: "50 units", deadline: "3 weeks", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
              ].map((req, i) => (
                <div key={i} className="flex items-start gap-4 p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={req.avatar}
                      alt={req.designer}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{req.designer}</h3>
                    <p className="text-sm text-neutral-500">{req.project}</p>
                    <p className="text-xs text-neutral-400">{req.quantity} • Due in {req.deadline}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-none">Decline</Button>
                    <Button size="sm" className="rounded-none bg-black text-white">Quote</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Active Orders */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { client: "Vogue Brand", status: "In Production", progress: 60 },
                { client: "Urban Threads", status: "Quality Check", progress: 90 },
                { client: "Eco Fashion Co", status: "Cutting", progress: 30 },
              ].map((order, i) => (
                <div key={i} className="p-3 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{order.client}</span>
                    <span className="text-xs text-neutral-500">{order.status}</span>
                  </div>
                  <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800">
                    <div 
                      className="h-full bg-black dark:bg-white" 
                      style={{ width: `${order.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="rounded-none border-neutral-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Elena Moreau", msg: "Can we adjust the timeline?", time: "30m" },
                { name: "Vogue Brand", msg: "Samples look great!", time: "2h" },
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
