FROM node:20-alpine

RUN npm install -g nodemon

WORKDIR /backend

COPY package.json .

RUN npm install

COPY . .

EXPOSE 5000

CMD [ "npm","run","dev" ]