# ============================================================
# Stage 1: Build — compile React + Vite production bundle
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build production bundle → /app/dist
RUN npm run build

# ============================================================
# Stage 2: Production — serve static files with nginx
# ============================================================
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
