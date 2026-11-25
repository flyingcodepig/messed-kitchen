# ---- 阶段一：构建前端 ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY client ./client
RUN npm run build

# ---- 阶段二：运行时 ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["node", "server/index.js"]