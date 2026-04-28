import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'model' | 'designer' | 'manufacturer' | 'photographer' | 'brand' | null

export type VerificationStatus = 'unverified' | 'pending' | 'verified'

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  role: UserRole
  avatar?: string
  verificationStatus: VerificationStatus
  verificationDocuments?: {
    idDocument?: string
    selfie?: string
    website?: string
  }
}

export interface Gig {
  id: string
  title: string
  description: string
  location: string
  payment: string
  date: string
  postedBy: string
  postedByRole: UserRole
  postedByAvatar?: string
  applications: number
}

export interface DesignPost {
  id: string
  image: string
  description: string
  author: string
  authorRole: UserRole
  authorAvatar?: string
  likes: number
  createdAt: string
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  gigs: Gig[]
  designPosts: DesignPost[]
  
  // Actions
  signup: (data: { fullName: string; email: string; phone: string; password: string }) => void
  setRole: (role: UserRole) => void
  login: (email: string, password: string) => boolean
  logout: () => void
  
  // Verification
  submitVerification: (documents: { idDocument?: string; selfie?: string; website?: string }) => void
  approveVerification: () => void
  
  // Gigs
  postGig: (gig: Omit<Gig, 'id' | 'applications'>) => void
  applyToGig: (gigId: string) => void
  
  // Feed
  addDesignPost: (post: Omit<DesignPost, 'id' | 'createdAt'>) => void
}

const mockGigs: Gig[] = [
  {
    id: '1',
    title: 'Fashion Campaign Model Needed',
    description: 'Looking for a tall model for our spring collection campaign. Experience preferred.',
    location: 'New York, NY',
    payment: '$500/day',
    date: '2026-05-15',
    postedBy: 'Luxe Brand Co',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop',
    applications: 12,
  },
  {
    id: '2',
    title: 'Streetwear Photographer',
    description: 'Need a creative photographer for urban streetwear lookbook.',
    location: 'Los Angeles, CA',
    payment: '$800/project',
    date: '2026-05-20',
    postedBy: 'Urban Threads',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    applications: 8,
  },
  {
    id: '3',
    title: 'Pattern Maker for Dress Collection',
    description: 'Seeking experienced manufacturer for small batch luxury dresses.',
    location: 'Remote',
    payment: '$2000/project',
    date: '2026-06-01',
    postedBy: 'Elena Designs',
    postedByRole: 'designer',
    postedByAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    applications: 5,
  },
]

const mockDesignPosts: DesignPost[] = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=1000&fit=crop',
    description: 'New collection preview. Exploring minimalism in haute couture.',
    author: 'Elena Moreau',
    authorRole: 'designer',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    likes: 2847,
    createdAt: '2 hours ago',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1000&fit=crop',
    description: 'Behind the scenes from our latest editorial shoot.',
    author: 'Marcus Chen',
    authorRole: 'photographer',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    likes: 4521,
    createdAt: '5 hours ago',
  },
]

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      gigs: mockGigs,
      designPosts: mockDesignPosts,

      signup: (data) => {
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: null,
          avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1534528741775-53994a69daeb' : '1507003211169-0a1dd7228f2d'}?w=100&h=100&fit=crop`,
          verificationStatus: 'unverified',
        }
        set({ user: newUser, isAuthenticated: true })
      },

      setRole: (role) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, role } })
        }
      },

      login: (email, password) => {
        // Simulate login - accept any for demo
        const mockUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          fullName: email.split('@')[0],
          email,
          phone: '',
          role: null,
          avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1534528741775-53994a69daeb' : '1507003211169-0a1dd7228f2d'}?w=100&h=100&fit=crop`,
          verificationStatus: 'unverified',
        }
        set({ user: mockUser, isAuthenticated: true })
        return true
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },

      submitVerification: (documents) => {
        const { user } = get()
        if (user) {
          set({
            user: {
              ...user,
              verificationStatus: 'pending',
              verificationDocuments: documents,
            },
          })
        }
      },

      approveVerification: () => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, verificationStatus: 'verified' } })
        }
      },

      postGig: (gigData) => {
        const newGig: Gig = {
          ...gigData,
          id: Math.random().toString(36).substr(2, 9),
          applications: 0,
        }
        set({ gigs: [newGig, ...get().gigs] })
      },

      applyToGig: (gigId) => {
        const { gigs } = get()
        set({
          gigs: gigs.map((g) =>
            g.id === gigId ? { ...g, applications: g.applications + 1 } : g
          ),
        })
      },

      addDesignPost: (postData) => {
        const newPost: DesignPost = {
          ...postData,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: 'Just now',
        }
        set({ designPosts: [newPost, ...get().designPosts] })
      },
    }),
    {
      name: 'thimble-storage',
    }
  )
)
