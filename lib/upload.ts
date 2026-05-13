export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const formData = new FormData()
  formData.append("file", file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          if (!response.url) {
            reject(new Error("Upload response missing URL"))
            return
          }
          resolve(response.url as string)
        } catch {
          reject(new Error("Failed to parse upload response"))
        }
      } else {
        let message = "Upload failed. Please try again."
        try {
          const errorBody = JSON.parse(xhr.responseText)
          if (errorBody?.error) message = errorBody.error
        } catch {
          // keep default message
        }
        reject(new Error(message))
      }
    }

    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(formData)
  })
}
