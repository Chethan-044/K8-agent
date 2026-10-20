FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN mkdir -p /app/data


COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]

