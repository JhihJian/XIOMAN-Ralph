FROM node:22-alpine

WORKDIR /app

# 安装依赖（利用 layer 缓存）
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build && npm prune --omit=dev

# 工作目录（运行时挂载）
WORKDIR /workspace

USER node
ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["run"]
