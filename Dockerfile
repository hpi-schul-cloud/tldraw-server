FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.build.json tsconfig.json ./

RUN npm ci --ignore-scripts

COPY src .

RUN npm run build
RUN npm prune --production

FROM registry.opencode.de/oci-community/images/zendis/nodejs:24-minimal AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NO_COLOR="true"

COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./

USER nonroot

EXPOSE 3345 3349 9090

CMD ["node", "dist/apps/tldraw-server.app.js"]
