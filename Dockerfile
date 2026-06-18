FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.build.json tsconfig.json nest-cli.json ./

RUN npm ci --ignore-scripts

COPY src ./src

RUN npm run build
RUN npm prune --production

FROM gcr.io/distroless/nodejs24-debian13:nonroot AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NO_COLOR="true"

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER nonroot

EXPOSE 3345 3349 9090

CMD ["dist/apps/tldraw-server.app.js"]
