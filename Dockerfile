FROM node:22-alpine
WORKDIR /app

# Install curl for optional container healthchecks
RUN apk add --no-cache curl

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci || npm install
RUN cd apps/web && (npm ci || npm install)
COPY . .
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
