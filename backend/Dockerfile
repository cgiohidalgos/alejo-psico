# backend/Dockerfile
FROM node:20-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y build-essential python3 curl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]
