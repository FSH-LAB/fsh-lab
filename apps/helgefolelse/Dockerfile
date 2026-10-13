FROM node:26.10.0-slim AS base

WORKDIR /app
RUN npm install --global corepack@0.36.0 && corepack enable pnpm

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.7 prune helgefolelse --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm turbo run build --filter=helgefolelse && \
    if [ -d apps/helgefolelse/public ]; then cp -R apps/helgefolelse/public apps/helgefolelse/.next/standalone/apps/helgefolelse/public; fi && \
    mkdir -p apps/helgefolelse/.next/standalone/apps/helgefolelse/.next/cache

FROM debian:13-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates libatomic1 \
    && useradd --system --uid 1000 --create-home node \
    && rm -rf /var/lib/apt/lists/*
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=builder --chown=node:node /app/apps/helgefolelse/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/helgefolelse/.next/static ./apps/helgefolelse/.next/static
USER node
EXPOSE 8080
CMD ["node", "apps/helgefolelse/server.js"]