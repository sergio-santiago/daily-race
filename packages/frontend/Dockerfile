FROM node:22-alpine

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
# Backend package.json needed for workspace resolution even if not used
COPY packages/backend/package.json ./packages/backend/

RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

# Build shared types
RUN npm run build --workspace=packages/shared

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=packages/frontend"]
