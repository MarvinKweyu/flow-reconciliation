FROM node:22-bullseye AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM node:22-bullseye AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000

# Install dependencies (include dev deps so drizzle-kit CLI is available at runtime)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Copy built dist and any runtime assets
COPY --from=builder /usr/src/app/dist ./dist

# Copy entrypoint
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["sh", "docker/entrypoint.sh"]
CMD ["node", "dist/main"]
