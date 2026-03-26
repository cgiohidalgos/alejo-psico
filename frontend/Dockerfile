# frontend/Dockerfile
FROM node:20-bullseye
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV PORT=9006
EXPOSE 9006
CMD ["npm", "run", "dev"]
