async function upload(
  _mediaInput: { organizationId: string; fileName: string },
  _file: File,
): Promise<void> {
  throw new Error("JunoFileService is not implemented");
}

async function deleteFile(
  _organizationId: string,
  _fileName: string,
): Promise<void> {
  throw new Error("JunoFileService is not implemented");
}

async function readFile(
  _organizationId: string,
  _fileName: string,
): Promise<Buffer> {
  throw new Error("JunoFileService is not implemented");
}

export const JunoFileService = {
  upload,
  deleteFile,
  readFile,
};
