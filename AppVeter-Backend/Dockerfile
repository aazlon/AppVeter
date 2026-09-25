FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN addgroup -S appveter && adduser -S appveter -G appveter \
    && mkdir -p public/uploads \
    && chown -R appveter:appveter /app

ENV NODE_ENV=production
EXPOSE 3000

USER appveter

CMD ["node", "Server.js"]
