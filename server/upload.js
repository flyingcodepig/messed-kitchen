import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uploadDir = join(root, 'data', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (extname(file.originalname) || '.jpg').toLowerCase().slice(0, 10);
    cb(null, randomBytes(16).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('只能上传图片文件'));
  }
});

export function handleUpload(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5MB' : err.message || '上传失败';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}