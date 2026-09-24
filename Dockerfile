# OBA Youth Abuja — runs anywhere that takes a container.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# Member data lives in Postgres (set DATABASE_URL), so this container keeps
# no state and can be restarted or replaced freely.

EXPOSE 3000
CMD ["node", "src/server.js"]
