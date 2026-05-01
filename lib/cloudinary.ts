/**
 * Universal Upload Helper (Now using Uploadcare)
 * Handles uploading files to the cloud with real-time progress.
 */

export const uploadToCloudinary = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  const publicKey = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY || "demopublickey";

  if (publicKey === "demopublickey") {
    console.warn("Uploadcare using demo key. Files will be deleted after 24 hours.");
  }

  const formData = new FormData();
  formData.append("UPLOADCARE_PUB_KEY", publicKey);
  formData.append("UPLOADCARE_STORE", "1");
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  
  return new Promise((resolve, reject) => {
    xhr.open("POST", "https://upload.uploadcare.com/base/");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Uploadcare returns a UUID. We format it into a CDN URL.
          const fileId = response.file;
          const url = `https://ucarecdn.com/${fileId}/`;
          resolve(url);
        } catch (e) {
          reject(new Error("Failed to parse Uploadcare response"));
        }
      } else {
        console.error("Uploadcare Error:", xhr.responseText);
        reject(new Error("Upload failed. Please try again."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
};
