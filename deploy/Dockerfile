# Build context is the repository root:
#   docker build -f deploy/Dockerfile .
FROM node:24-alpine AS build
RUN npm install -g pnpm@10
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build
# vite.config.ts requires PORT and BASE_PATH at config-load time
RUN PORT=20302 BASE_PATH=/app pnpm --filter @workspace/draftfly run build
RUN PORT=18150 BASE_PATH=/ pnpm --filter @workspace/landing run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv
COPY --from=build /repo/artifacts/api-server/dist ./api
COPY --from=build /repo/artifacts/draftfly/dist/public ./static/app
COPY --from=build /repo/artifacts/landing/dist/public ./static/landing
ENV PORT=8080 \
    STATIC_APP_DIR=/srv/static/app \
    STATIC_LANDING_DIR=/srv/static/landing
EXPOSE 8080
CMD ["node", "--enable-source-maps", "/srv/api/index.mjs"]
