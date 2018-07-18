FROM node:alpine

RUN apk add --no-cache make gcc g++ python git

COPY . /src/persona-rpc

RUN cd /src/persona-rpc \
    && npm install -g forever \
    && npm install

WORKDIR /src/persona-rpc
ENTRYPOINT ["forever","./server.js"]

EXPOSE 8080
