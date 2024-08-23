FROM docker.io/node:20-alpine

ENV TZ=Europe/Berlin
RUN mkdir /app && chown -R node:node /app
WORKDIR /app

COPY tsconfig.json tsconfig.build.json package.json package-lock.json nest-cli.json ./

RUN npm ci && npm cache clean --force

COPY src /app/src

RUN npm run build

ENV NODE_ENV=production
ENV NO_COLOR="true"

CMD ["npm", "run", "start:server:prod"]
