const UPLOAD_FAILED = "Couldn't upload the image. Try again.";

/**
 * Uploads an image answer and resolves to its upload ID. Uses XHR rather than
 * the RPC client so it can report progress, as a percentage.
 */
export function uploadFormImage(
  formId: string,
  file: File,
  onProgress: (percent: number) => void,
) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/forms/${encodeURIComponent(formId)}/uploads`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const body = xhr.response as { id?: string; error?: string } | null;
      if (xhr.status === 201 && body?.id) {
        resolve({ id: body.id });
      } else {
        reject(new Error(body?.error ?? UPLOAD_FAILED));
      }
    };
    xhr.onerror = () => reject(new Error(UPLOAD_FAILED));

    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
