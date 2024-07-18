FROM docker.io/node:20-alpine

ENV TZ=Europe/Berlin
RUN mkdir /app && chown -R node:node /app
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY src /app/src

ENV NODE_ENV=production
ENV NO_COLOR="true"

CMD npm run start:y-redis-server