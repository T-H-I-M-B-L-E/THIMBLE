export type UploadFolder = 'avatars' | 'posts' | 'verification'

export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void,
  folder: UploadFolder = 'posts'
): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const xhr = new XMLHttpRequest()

  return new Promise((resolve, reject) => {
    xhr.open('POST', '/api/upload')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response.url)
        } catch {
          reject(new Error('Failed to parse upload response'))
        }
      } else {
        try {
          const response = JSON.parse(xhr.responseText)
          reject(new Error(response.error || 'Upload failed. Please try again.'))
        } catch {
          reject(new Error('Upload failed. Please try again.'))
        }
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(formData)
  })
}
