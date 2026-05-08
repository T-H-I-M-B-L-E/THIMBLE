/**
 * Tests for /lib/platform.ts
 *
 * Covers:
 *  - getPostAuthPath: JWT users (role at top level), Clerk users (unsafeMetadata),
 *    no-user, null-user, user with no role
 *  - getDashboardFeedPath: role → correct path
 *  - normalizeWebsiteUrl: various URL formats
 *  - getSafeHostname: edge cases
 */

// platform.ts is a client module ("use client") but its helpers are pure
// functions we can exercise in Node without any browser globals.
// We manually mock next/navigation if needed — it's not imported by platform.ts.

import {
  getPostAuthPath,
  getDashboardFeedPath,
  normalizeWebsiteUrl,
  getSafeHostname,
} from '@/lib/platform'

// ─────────────────────────────────────────────────────────────────────────────
//  getDashboardFeedPath
// ─────────────────────────────────────────────────────────────────────────────

describe('getDashboardFeedPath', () => {
  it('returns /onboarding when role is null', () => {
    expect(getDashboardFeedPath(null)).toBe('/onboarding')
  })

  it('returns /onboarding when role is undefined', () => {
    expect(getDashboardFeedPath(undefined)).toBe('/onboarding')
  })

  it('returns /onboarding when role is empty string', () => {
    expect(getDashboardFeedPath('')).toBe('/onboarding')
  })

  it('returns correct path for model', () => {
    expect(getDashboardFeedPath('model')).toBe('/dashboard/model/feed')
  })

  it('returns correct path for designer', () => {
    expect(getDashboardFeedPath('designer')).toBe('/dashboard/designer/feed')
  })

  it('returns correct path for photographer', () => {
    expect(getDashboardFeedPath('photographer')).toBe('/dashboard/photographer/feed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getPostAuthPath — JWT users (role at top level)
// ─────────────────────────────────────────────────────────────────────────────

describe('getPostAuthPath — JWT users', () => {
  it('routes to dashboard/feed when role is set', () => {
    expect(getPostAuthPath({ role: 'model' })).toBe('/dashboard/model/feed')
  })

  it('routes to dashboard/feed for designer role', () => {
    expect(getPostAuthPath({ role: 'designer' })).toBe('/dashboard/designer/feed')
  })

  it('routes to /onboarding when role is null', () => {
    expect(getPostAuthPath({ role: null })).toBe('/onboarding')
  })

  it('routes to /onboarding when role is undefined', () => {
    expect(getPostAuthPath({ role: undefined })).toBe('/onboarding')
  })

  it('routes to /onboarding when role is empty string', () => {
    expect(getPostAuthPath({ role: '' })).toBe('/onboarding')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getPostAuthPath — no user / null
// ─────────────────────────────────────────────────────────────────────────────

describe('getPostAuthPath — no user', () => {
  it('returns /auth for null', () => {
    expect(getPostAuthPath(null)).toBe('/auth')
  })

  it('returns /auth for undefined', () => {
    expect(getPostAuthPath(undefined)).toBe('/auth')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getPostAuthPath — legacy Clerk users (unsafeMetadata)
// ─────────────────────────────────────────────────────────────────────────────

describe('getPostAuthPath — Clerk legacy users', () => {
  it('routes to dashboard when onboardingCompleted=true and role is set', () => {
    const user = { unsafeMetadata: { role: 'brand', onboardingCompleted: true } }
    expect(getPostAuthPath(user)).toBe('/dashboard/brand/feed')
  })

  it('routes to /onboarding when onboardingCompleted=false', () => {
    const user = { unsafeMetadata: { role: 'model', onboardingCompleted: false } }
    expect(getPostAuthPath(user)).toBe('/onboarding')
  })

  it('routes to /onboarding when onboardingCompleted is missing', () => {
    const user = { unsafeMetadata: { role: 'model' } }
    expect(getPostAuthPath(user)).toBe('/onboarding')
  })

  it('routes to /onboarding when role is missing even if onboarded', () => {
    const user = { unsafeMetadata: { onboardingCompleted: true } }
    expect(getPostAuthPath(user)).toBe('/onboarding')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  normalizeWebsiteUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeWebsiteUrl', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeWebsiteUrl('')).toBe('')
  })

  it('returns empty string for whitespace', () => {
    expect(normalizeWebsiteUrl('   ')).toBe('')
  })

  it('leaves https:// URLs unchanged', () => {
    expect(normalizeWebsiteUrl('https://example.com')).toBe('https://example.com')
  })

  it('leaves http:// URLs unchanged', () => {
    expect(normalizeWebsiteUrl('http://example.com')).toBe('http://example.com')
  })

  it('adds https:// to bare domains', () => {
    expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com')
  })

  it('adds https:// to www domains', () => {
    expect(normalizeWebsiteUrl('www.my-site.io')).toBe('https://www.my-site.io')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  getSafeHostname
// ─────────────────────────────────────────────────────────────────────────────

describe('getSafeHostname', () => {
  it('returns empty string for empty input', () => {
    expect(getSafeHostname('')).toBe('')
  })

  it('extracts hostname from https URL', () => {
    expect(getSafeHostname('https://example.com/path')).toBe('example.com')
  })

  it('extracts hostname from bare domain', () => {
    expect(getSafeHostname('portfolio.io')).toBe('portfolio.io')
  })

  it('returns empty string for totally invalid input', () => {
    // normalizeWebsiteUrl will make it "https://::::", which is not a valid URL
    expect(getSafeHostname(':::invalid')).toBe('')
  })
})
