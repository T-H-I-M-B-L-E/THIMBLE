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
  bio?: string
  location?: string
  website?: string
  verificationStatus: VerificationStatus
  verificationDocuments?: {
    idDocument?: string
    selfie?: string
    website?: string
  }
  followers?: number
  following?: number
  posts?: number
  isBanned?: boolean
  bannedUntil?: string | null
  banMessage?: string
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
  postedByVerified?: boolean
  applications: number
  requirements?: string[]
  category?: string
}

export interface DesignPost {
  id: string
  userId?: string
  image: string
  description: string
  author: string
  authorRole: UserRole
  authorAvatar?: string
  authorVerified?: boolean
  likes: number
  comments?: number
  createdAt: string
  tags?: string[]
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  hasSeenWelcome: boolean
  gigs: Gig[]
  designPosts: DesignPost[]

  // Actions
  signup: (data: { fullName: string; email: string; phone: string; password: string }) => void
  setRole: (role: UserRole) => void
  login: (email: string, password: string) => boolean
  logout: () => void
  updateProfile: (data: Partial<User>) => void

  // Verification
  submitVerification: (documents: { idDocument?: string; selfie?: string; website?: string }) => void
  approveVerification: () => void

  // Gigs
  postGig: (gig: Omit<Gig, 'id' | 'applications'>) => void
  applyToGig: (gigId: string) => void

  // Feed
  addDesignPost: (post: Omit<DesignPost, 'id' | 'createdAt'>) => void
  removeDesignPost: (postId: string) => void
  likePost: (postId: string) => void
  setUser: (user: User | null) => void
  setHasSeenWelcome: (value: boolean) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hasSeenWelcome: true,
      gigs: [],
      designPosts: [],

      signup: (data) => {
        const newUser: User = {
          id: crypto.randomUUID(),
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: null,
          avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1534528741775-53994a69daeb' : '1507003211169-0a1dd7228f2d'}?w=100&h=100&fit=crop`,
          bio: '',
          location: '',
          website: '',
          verificationStatus: 'unverified',
          followers: 0,
          following: 0,
          posts: 0,
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
        const mockUser: User = {
          id: crypto.randomUUID(),
          fullName: email.split('@')[0],
          email,
          phone: '',
          role: null,
          avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1534528741775-53994a69daeb' : '1507003211169-0a1dd7228f2d'}?w=100&h=100&fit=crop`,
          bio: '',
          location: '',
          website: '',
          verificationStatus: 'unverified',
          followers: 0,
          following: 0,
          posts: 0,
        }
        set({ user: mockUser, isAuthenticated: true })
        return true
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },

      updateProfile: (data) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...data } })
        }
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
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          createdAt: 'Just now',
        }
        set({ designPosts: [newPost, ...get().designPosts] })
      },

      removeDesignPost: (postId) => {
        set({
          designPosts: get().designPosts.filter((post) => post.id !== postId),
        })
      },

      likePost: (postId) => {
        const { designPosts } = get()
        set({
          designPosts: designPosts.map((post) =>
            post.id === postId ? { ...post, likes: post.likes + 1 } : post
          ),
        })
      },
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setHasSeenWelcome: (value) => set({ hasSeenWelcome: value }),
    }),
    {
      name: 'thimble-storage',
    }
  )
)
