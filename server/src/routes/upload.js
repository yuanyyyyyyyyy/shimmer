import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ValidationError } from '../middleware/error.js';
import { uploadToR2, getPublicUrl } from '../config/r2.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的图片格式'), false);
    }
  }
});

async function processImage(buffer, filename) {
  const ext = '.jpg';
  const name = uuidv4();

  const compressedKey = `compressed/${name}${ext}`;
  const thumbnailKey = `thumbnails/${name}${ext}`;

  const compressedBuffer = await sharp(buffer)
    .resize(1920, null, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const thumbnailBuffer = await sharp(buffer)
    .resize(400, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  await uploadToR2(compressedKey, compressedBuffer, 'image/jpeg');
  await uploadToR2(thumbnailKey, thumbnailBuffer, 'image/jpeg');

  const metadata = await sharp(buffer).metadata();

  const exifData = {};
  try {
    const ifd0 = metadata.ifd0 || {};
    const exif = metadata.exif || {};

    const make = ifd0.Make ? String(ifd0.Make).trim() : '';
    const model = ifd0.Model ? String(ifd0.Model).trim() : '';
    if (make && model) {
      exifData.camera = `${make} ${model}`;
    } else if (model) {
      exifData.camera = model;
    }

    exifData.lens = exif.LensModel ? String(exif.LensModel).trim() : null;

    if (exif.FNumber) {
      const f = exif.FNumber;
      const val = Array.isArray(f) ? f[0] / f[1] : Number(f);
      exifData.aperture = `ƒ/${Math.round(val * 10) / 10}`;
    }

    if (exif.ExposureTime) {
      const et = exif.ExposureTime;
      if (Array.isArray(et)) {
        exifData.shutter_speed = et[0] >= et[1]
          ? `${Math.round(et[0] / et[1])}s`
          : `${et[0]}/${et[1]}s`;
      } else {
        exifData.shutter_speed = `${et}s`;
      }
    }

    exifData.iso = exif.ISO ? Number(exif.ISO) : null;

    if (exif.FocalLength) {
      const fl = exif.FocalLength;
      const mm = Array.isArray(fl) ? Math.round(fl[0] / fl[1]) : Math.round(Number(fl));
      exifData.focal_length = `${mm}mm`;
    }
  } catch (e) {
    console.warn('[EXIF] 提取失败:', e.message);
  }

  return {
    url: getPublicUrl(compressedKey),
    thumbnailUrl: getPublicUrl(thumbnailKey),
    width: metadata.width,
    height: metadata.height,
    file_size: Math.round(compressedBuffer.length / 1024),
    ...exifData
  };
}

router.post('/upload', authenticateToken, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('请选择要上传的图片');
    }

    const processed = await processImage(req.file.buffer, req.file.originalname);

    res.json({
      message: '上传成功',
      ...processed
    });
  } catch (err) {
    next(err);
  }
});

router.post('/upload-multiple', authenticateToken, upload.array('photos', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('请选择要上传的图片');
    }

    const results = await Promise.all(
      req.files.map(file => processImage(file.buffer, file.originalname))
    );

    res.json({
      message: `成功上传 ${results.length} 张图片`,
      photos: results
    });
  } catch (err) {
    next(err);
  }
});

export default router;
