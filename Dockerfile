# OBA Youth Abuja — runs anywhere that takes a container.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# The SQLite file lives here. Mount a volume on this path so member data
# survives a redeploy.
ENV DATABASE_FILE=/data/oba.db
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "src/server.js"]
