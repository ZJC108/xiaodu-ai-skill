# 适用于 Hugging Face Spaces / 任意容器托管（保留 node:crypto 验签逻辑，无需改造）
FROM node:20-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# 复制源码并构建
COPY . .
RUN npm run build

# HF Spaces 通过 $PORT 注入端口；其他平台未设置时回落到 3000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npm run start"]
