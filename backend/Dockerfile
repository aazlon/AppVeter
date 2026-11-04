FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN addgroup -S petsproduct && adduser -S petsproduct -G petsproduct \
    && chown -R petsproduct:petsproduct /app

ENV NODE_ENV=production
EXPOSE 3000

USER petsproduct

CMD ["node", "Server.js"]
