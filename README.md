# 胡闹厨房

面向在校同学的约饭协作网站：一起发起约饭、认领菜品、自动汇总采购清单、AA 结算、给大厨点赞，还有厨房挑战榜。

## 功能

- 邮箱注册验证，约饭发起 / 时间变更 / 结束邮件通知
- 每个厨房是一个房间，凭邀请码加入，可加入多个厨房
- 报名认领菜品并填写所需食材，自动汇总成采购清单并与库存对比
- 指定采购人统一填写采购与价格，已购食材一键入库
- 约饭结束后点赞大厨（每人每场一次），荣誉归个人
- AA 按参与人均摊结算
- 每道菜上传照片、每场上传合影，详情页总结区展示
- 厨房挑战榜：发布菜品挑战 → 揭榜选定约饭制作 → 发起人判定完成加积分
- 个人主页：蔬菜默认头像 / 自定义头像、获赞记录、挑战积分与揭榜记录

## 技术栈

- 前端：React 18 + Vite 6 + react-router-dom
- 后端：Express 4（ESM）+ JWT + bcryptjs + nodemailer + multer
- 数据库：SQLite（Node 内置 `node:sqlite`，无需原生编译）

## 环境要求

- **Node.js ≥ 22.5**（用到内置 `node:sqlite`，推荐 Node 24）
- npm

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# 编辑 .env，至少改 JWT_SECRET 为随机长字符串：
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. 启动前后端（后端 3001，前端 5173）
npm run dev
```

打开 http://localhost:5173 即可。

> 邮件开发模式：`.env` 中 SMTP 字段留空时，邮件内容打印到服务端控制台，注册接口直接返回验证链接，方便本地调试。填好真实 SMTP 后才会真正发信。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动后端与前端开发服务 |
| `npm run server` | 仅启动后端 |
| `npm run build` | 构建前端到 `dist/` |
| `npm start` | 生产模式启动后端（托管 `dist/`，单端口 3001） |

## 目录结构

```
client/           前端（Vite root）
  src/pages/      各页面
  public/         静态资源（背景图、默认头像）
server/           后端
  routes/         auth / kitchens / events / inventory / users / challenges
  db.js           建表与迁移
  mailer.js       邮件（含开发模式）
  upload.js       图片上传
data/             运行时生成：SQLite 数据库 + 上传图片（不入库）
```

## 部署（Docker）

```bash
cp .env.production .env     # 填写真实 JWT_SECRET / APP_URL / SMTP
docker compose up -d --build
```

服务监听 3001，`data/` 通过数据卷持久化。修改 `.env` 后需 `docker compose up -d --force-recreate` 才会重新读取。

## 协作约定

1. `main` 为保护分支，不直接推送。
2. 从 `main` 切功能分支：`git checkout -b feature/xxx`。
3. 提交后推送并发起 Pull Request，互相 review 后合并。
4. **不要提交** `.env`、`data/`、`node_modules/`（已在 `.gitignore` 中排除）。