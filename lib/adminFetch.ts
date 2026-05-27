// Wrapper around fetch for admin pages. Redirects to /admin/login with
// a "session expired" message on any 401 response so the admin always
// knows why they were kicked out rather than seeing a cryptic error.
export async function adminFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init })
  if (res.status === 401) {
    window.location.replace('/admin/login?reason=expired')
    // Return a never-resolving promise so the caller doesn't continue
    return new Promise(() => {})
  }
  return res
}
