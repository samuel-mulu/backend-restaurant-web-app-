import { v2 as cloudinary, UploadApiOptions } from "cloudinary";
import streamifier from "streamifier";

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
  process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error("Missing Cloudinary env vars.");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

type UploadResult = { url: string; public_id: string };

export function uploadImage(
  buffer: Buffer,
  folder = "products",
  removeBackground = false
): Promise<UploadResult> {
  const options: UploadApiOptions = {
    folder,
    resource_type: "image",
    unique_filename: true,
    overwrite: false,
    timeout: 60_000,
  };

  // if (removeBackground) {
  // (options as any).background_removal = "cloudinary_ai";
  // }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
      if (err) return reject(err);
      if (!res) return reject(new Error("Cloudinary returned no result"));
      resolve({ url: res.secure_url, public_id: res.public_id });
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export async function uploadFile(
  buffer: Buffer,
  folder: string,
  resourceType: "auto" | "raw" | "image" | "video" = "auto"
): Promise<UploadResult> {
  const options: UploadApiOptions = {
    folder,
    resource_type: resourceType,
    unique_filename: true,
    overwrite: false,
    timeout: 60_000,
  };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
      if (err) return reject(err);
      if (!res) return reject(new Error("Cloudinary returned no result"));
      resolve({ url: res.secure_url, public_id: res.public_id });
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export async function deleteImage(public_id: string): Promise<void> {
  const res = await cloudinary.uploader.destroy(public_id);
  if (res.result !== "ok" && res.result !== "not found") {
    throw new Error(`Failed to delete asset: ${public_id} (${res.result})`);
  }
}

export { cloudinary };
