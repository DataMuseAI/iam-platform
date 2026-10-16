FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci || npm install
RUN cd apps/web && (npm ci || npm install)
COPY . .
