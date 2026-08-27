FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci

COPY packages/backend/ ./packages/backend/

RUN npm run build --workspace=packages/backend

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/assets ./packages/backend/assets

EXPOSE 3001

CMD ["node", "packages/backend/dist/main.js"]
