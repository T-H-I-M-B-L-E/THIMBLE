"use client"

import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, MapPin, DollarSign, Calendar } from "lucide-react"
import { useState, useEffect, use } from "react"
import Image from "next/image"

export default function GigsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = use(params)
  const { user, applyToGig } = useStore()
  const [gigs, setGigs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const isVerified = user?.verificationStatus === "verified"

  useEffect(() => {
    fetchGigs()
  }, [])

  const fetchGigs = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/gigs")
      const data = await res.json()
      setGigs(data)
    } catch (err) {
      console.error("Failed to fetch gigs:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredGigs = gigs.filter(gig =>
    gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gig.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout role={role}>
      <div className="mb-6">
        <h1 className="text-2xl font-light mb-2 uppercase tracking-widest">Marketplace</h1>
        <p className="text-neutral-500 text-sm">
          {isVerified 
            ? "Browse and apply to live creative opportunities."
            : "Complete verification to unlock gig applications."
          }
        </p>
      </div>

      {isLoading ? (
         <div className="flex justify-center py-20">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
         </div>
      ) : (
        <>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          placeholder="Search gigs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-none border-neutral-300"
        />
      </div>

      {/* Gigs List */}
      <div className="space-y-4">
        {filteredGigs.map((gig) => (
          <Card key={gig.id} className="rounded-none border-neutral-200">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Poster Info */}
                <div className="flex items-start gap-3 sm:w-48 flex-shrink-0">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden">
                    <Image
                      src={gig.postedByAvatar || "/placeholder-avatar.png"}
                      alt={gig.postedBy}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{gig.postedBy}</p>
                    <p className="text-xs text-neutral-500 capitalize">{gig.postedByRole}</p>
                  </div>
                </div>

                {/* Gig Details */}
                <div className="flex-1">
                  <h3 className="font-medium text-lg mb-1">{gig.title}</h3>
                  <p className="text-neutral-500 text-sm mb-3">{gig.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {gig.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {gig.payment}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {gig.date}
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-xs text-neutral-400">{gig.applications} applied</span>
                  <Button
                    size="sm"
                    className="rounded-none bg-black text-white"
                    disabled={!isVerified}
                    onClick={() => applyToGig(gig.id)}
                  >
                    {isVerified ? "Apply" : "Verify to Apply"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredGigs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-500">No gigs found matching your search</p>
          </div>
        )}
      </div>
    </>
  )}
</DashboardLayout>
  )
}
