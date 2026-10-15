ARG NODE_VERSION=24.20.0
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app
RUN npm install --global corepack@0.36.0 && corepack enable pnpm

FROM base AS pruner
ARG APP_NAME
COPY . .
RUN pnpm dlx turbo@2.11.7 prune ${APP_NAME} --docker

FROM base AS builder
ARG APP_NAME
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm turbo run build --filter=${APP_NAME} && \
    if [ -d "apps/${APP_NAME}/public" ]; then \
      mkdir -p "apps/${APP_NAME}/.next/standalone/apps/${APP_NAME}/public" && \
      cp -R "apps/${APP_NAME}/public/." "apps/${APP_NAME}/.next/standalone/apps/${APP_NAME}/public/"; \
    fi && \
    mkdir -p "apps/${APP_NAME}/.next/standalone/apps/${APP_NAME}/.next/cache" && \
    ln -s "apps/${APP_NAME}/server.js" "apps/${APP_NAME}/.next/standalone/server.js"

FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runner
ARG APP_NAME
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=builder --chown=nonroot:nonroot /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
EXPOSE 8080
CMD ["server.js"]

