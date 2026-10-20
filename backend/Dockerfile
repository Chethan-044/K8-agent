# ============================================================
# Stage 1: Build — compile TypeScript & install all dependencies
# ============================================================
FROM node:22-alpine AS builder

# better-sqlite3 requires native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
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
FROM node:22-alpine

WORKDIR /app

# Copy only compiled output + production node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create persistent data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/server.js"]
