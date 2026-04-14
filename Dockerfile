FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.build.json tsconfig.json ./

RUN npm ci --ignore-scripts

COPY src .

RUN npm run build
RUN npm prune --production

FROM gcr.io/distroless/nodejs22-debian12 AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NO_COLOR="true"

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER nonroot

EXPOSE 3345 3349 9090

CMD ["dist/apps/tldraw-server.app.js"]
