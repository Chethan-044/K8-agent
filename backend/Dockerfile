# ============================================================
# Stage 1: Build — compile TypeScript & install all dependencies
# ============================================================
FROM node:20-alpine AS builder

# better-sqlite3 requires native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Point node-gyp to use locally installed Node.js headers
# to avoid downloading from unofficial-builds.nodejs.org (which can timeout)
ENV npm_config_nodedir=/usr/local

RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript → JavaScript
RUN npm run build

# Prune dev dependencies (keeps only production deps + native addons)
RUN npm prune --production

# ============================================================
# Stage 2: Production — minimal runtime image
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Copy only compiled output + production node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create persistent data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/server.js"]

