# ---------- Build stage ----------
FROM node:20-bookworm-slim AS build

RUN apt-get update \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---------- Production stage ----------
FROM node:20-bookworm-slim AS production

RUN apt-get update \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled app
COPY --from=build /app/dist ./dist

# Copy Prisma schema
COPY --from=build /app/prisma ./prisma

# Copy generated Prisma client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
