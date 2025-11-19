import multer from "multer";
import type { Request } from "express";

const storage = multer.memoryStorage();

const imageFilter: multer.Options["fileFilter"] = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype?.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

export const uploadImageMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter,
});

export const uploadMultipleImagesMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter,
}).array("images", 10); // Allow up to 10 images
