FROM docker.io/node:18-alpine as builder

RUN mkdir /app && chown -R node:node /app
WORKDIR /app

COPY package.json .
COPY package-lock.json .
RUN npm i
COPY . ./

# production environment
EXPOSE 3333
CMD ["npm", "start"]
