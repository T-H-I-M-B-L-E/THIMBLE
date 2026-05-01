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
  likePost: (postId: string) => void
  setUser: (user: User | null) => void
  setHasSeenWelcome: (value: boolean) => void
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
    postedByVerified: true,
    applications: 12,
    requirements: ['Height: 5\'9"+', 'Experience: 2+ years', 'Age: 18-30'],
    category: 'Campaign',
  },
  {
    id: '2',
    title: 'Streetwear Photographer',
    description: 'Need a creative photographer for urban streetwear lookbook. Must have portfolio.',
    location: 'Los Angeles, CA',
    payment: '$800/project',
    date: '2026-05-20',
    postedBy: 'Urban Threads',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    postedByVerified: true,
    applications: 8,
    requirements: ['Portfolio required', 'Own equipment', 'Editorial experience'],
    category: 'Photography',
  },
  {
    id: '3',
    title: 'Pattern Maker for Dress Collection',
    description: 'Seeking experienced manufacturer for small batch luxury dresses. High quality required.',
    location: 'Remote',
    payment: '$2000/project',
    date: '2026-06-01',
    postedBy: 'Elena Designs',
    postedByRole: 'designer',
    postedByAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    postedByVerified: true,
    applications: 5,
    requirements: ['5+ years experience', 'Luxury garments', 'Quick turnaround'],
    category: 'Manufacturing',
  },
  {
    id: '4',
    title: 'Runway Model for Fashion Week',
    description: 'Casting for Paris Fashion Week show. High fashion experience required.',
    location: 'Paris, France',
    payment: '€1000/day',
    date: '2026-06-15',
    postedBy: 'Haute Couture House',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    postedByVerified: true,
    applications: 45,
    requirements: ['Runway experience', 'Height: 5\'10"+', 'Available for fittings'],
    category: 'Runway',
  },
  {
    id: '5',
    title: 'E-commerce Product Photographer',
    description: 'Need clean product shots for online store. White background preferred.',
    location: 'London, UK',
    payment: '£300/day',
    date: '2026-05-25',
    postedBy: 'Minimal Studio',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    postedByVerified: false,
    applications: 15,
    requirements: ['Studio lighting', 'E-commerce experience', '24hr turnaround'],
    category: 'Photography',
  },
  {
    id: '6',
    title: 'Sustainable Fashion Designer',
    description: 'Looking for eco-conscious designer for capsule collection.',
    location: 'Berlin, Germany',
    payment: '€5000/project',
    date: '2026-07-01',
    postedBy: 'EcoWear Brand',
    postedByRole: 'brand',
    postedByAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop',
    postedByVerified: true,
    applications: 22,
    requirements: ['Sustainable materials knowledge', '3+ years experience', 'Portfolio'],
    category: 'Design',
  },
]

const mockDesignPosts: DesignPost[] = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=1000&fit=crop',
    description: 'New collection preview. Exploring minimalism in haute couture. What do you think?',
    author: 'Elena Moreau',
    authorRole: 'designer',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    authorVerified: true,
    likes: 2847,
    comments: 126,
    createdAt: '2 hours ago',
    tags: ['#minimalism', '#hautecouture', '#fashiondesign'],
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1000&fit=crop',
    description: 'Behind the scenes from our latest editorial shoot. The art of light and shadow.',
    author: 'Marcus Chen',
    authorRole: 'photographer',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    authorVerified: true,
    likes: 4521,
    comments: 89,
    createdAt: '5 hours ago',
    tags: ['#editorial', '#fashionphotography', '#bts'],
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop',
    description: 'Campaign shoot for THIMBLE Spring 2026. Dreams woven into fabric.',
    author: 'Sofia Laurent',
    authorRole: 'model',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    authorVerified: true,
    likes: 8934,
    comments: 312,
    createdAt: '8 hours ago',
    tags: ['#campaign', '#spring2026', '#modeling'],
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=1000&fit=crop',
    description: 'Textures and tones. Finding beauty in the details of everyday fashion.',
    author: 'Adrian Voss',
    authorRole: 'photographer',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    authorVerified: false,
    likes: 3267,
    comments: 78,
    createdAt: '12 hours ago',
    tags: ['#textures', '#details', '#fashion'],
  },
  {
    id: '5',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&h=1000&fit=crop',
    description: 'Summer collection dropping next week! Pre-orders open now.',
    author: 'Luna Designs',
    authorRole: 'designer',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    authorVerified: true,
    likes: 5621,
    comments: 245,
    createdAt: '1 day ago',
    tags: ['#summercollection', '#newdrop', '#fashion'],
  },
  {
    id: '6',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&h=1000&fit=crop',
    description: 'Street style vibes from Tokyo Fashion Week.',
    author: 'Harper Studio',
    authorRole: 'photographer',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop',
    authorVerified: true,
    likes: 1892,
    comments: 67,
    createdAt: '1 day ago',
    tags: ['#streetstyle', '#tokyo', '#fashionweek'],
  },
]

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hasSeenWelcome: true, // Default to true so it doesn't show on every refresh unless triggered
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
          id: Math.random().toString(36).substr(2, 9),
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
