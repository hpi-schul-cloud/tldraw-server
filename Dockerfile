FROM docker.io/node:20-alpine

RUN apk add gcompat

ENV TZ=Europe/Berlin
RUN mkdir /app && chown -R node:node /app
WORKDIR /app

RUN touch .env
COPY package.json package-lock.json ./

RUN npm ci && npm cache clean --force && npm run build

COPY dist /app/dist
# temporey hack to fix dependencies on var AUTH_PUBLIC_KEY
RUN npx 0ecdsa-generate-keypair --name auth >> .env

ENV NODE_ENV=production
ENV NO_COLOR="true"

CMD ["npm", "run", "start:server:prod"]
