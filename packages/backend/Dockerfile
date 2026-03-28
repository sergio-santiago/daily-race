FROM node:22-alpine

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
# Frontend package.json needed for workspace resolution even if not used
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Build shared types
RUN npm run build --workspace=packages/shared

EXPOSE 3001

CMD ["npm", "run", "start:dev", "--workspace=packages/backend"]
