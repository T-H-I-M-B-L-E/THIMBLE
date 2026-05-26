export type UploadFolder = 'avatars' | 'posts' | 'verification'

type ProgressHandler = (progress: number) => void

// Try the fast path (presigned PUT direct to R2) first. If anything
// goes wrong — network, CORS, missing endpoint — fall back to the
// Next.js-proxied multipart upload so a misconfigured deploy still works.
export const uploadFile = async (
  file: File,
  onProgress?: ProgressHandler,
  folder: UploadFolder = 'posts'
): Promise<string> => {
  try {
    return await uploadDirect(file, onProgress, folder)
  } catch (err) {
    console.warn('Direct R2 upload failed, falling back to proxy:', err)
    return uploadViaProxy(file, onProgress, folder)
  }
}

async function uploadDirect(
  file: File,
  onProgress: ProgressHandler | undefined,
  folder: UploadFolder
): Promise<string> {
  const presignRes = await fetch('/api/upload/presign', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      folder,
    }),
  })
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}))
    throw new Error(body?.error || `Presign failed (${presignRes.status})`)
  }
  const { uploadUrl, publicUrl, headers } = await presignRes.json() as {
    uploadUrl: string
    publicUrl: string
    headers: Record<string, string>
  }

  await putWithProgress(uploadUrl, file, headers, onProgress)
  return publicUrl
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: ProgressHandler
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`R2 PUT failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during direct upload'))
    xhr.send(file)
  })
}

function uploadViaProxy(
  file: File,
  onProgress: ProgressHandler | undefined,
  folder: UploadFolder
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          if (!response.url) {
            reject(new Error('Upload response missing URL'))
            return
          }
          resolve(response.url as string)
        } catch {
          reject(new Error('Failed to parse upload response'))
        }
      } else {
        let message = 'Upload failed. Please try again.'
        try {
          const errorBody = JSON.parse(xhr.responseText)
          if (errorBody?.error) message = errorBody.error
        } catch {
          // keep default message
        }
        reject(new Error(message))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(formData)
  })
}
