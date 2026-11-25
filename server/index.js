import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js';
import { mailEnabled } from './mailer.js';
import authRoutes from './routes/auth.js';
import kitchenRoutes from './routes/kitchens.js';
import eventRoutes from './routes/events.js';
import inventoryRoutes from './routes/inventory.js';
import userRoutes from './routes/users.js';
import challengeRoutes from './routes/challenges.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/kitchens', kitchenRoutes);
app.use('/api', eventRoutes);
app.use('/api', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api', challengeRoutes);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
app.use('/uploads', express.static(join(root, 'data', 'uploads')));
const dist = join(root, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[胡闹厨房] API 已启动: http://localhost:${port}`);
  if (!mailEnabled) console.log('[胡闹厨房] 未配置 SMTP，邮件进入开发模式（打印到控制台）');
});