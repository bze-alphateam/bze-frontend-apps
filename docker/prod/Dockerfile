# Production image for ONE app of the monorepo. Build from the repo root:
#
#   docker build -f docker/prod/Dockerfile \
#     --build-arg APP=dex --build-arg PKG=bze-dapp-v2 --build-arg FLAVOR=mainnet .
#
#   APP    = directory name under apps/
#   PKG    = that app's package.json "name" (turbo --filter target)
#   FLAVOR = mainnet | testnet — selects apps/<APP>/.env.<FLAVOR>.dist, whose
#            NEXT_PUBLIC_* values are inlined at build time. All of them are
#            public by definition; runtime-only secrets (SKIP_API_KEY) are NOT
#            baked — the server injects them via the container environment.

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

ARG APP
ARG PKG
ARG FLAVOR=mainnet
# Next reads apps/<APP>/.env at build time; turbo builds workspace deps first.
RUN cp "apps/${APP}/.env.${FLAVOR}.dist" "apps/${APP}/.env" \
    && mkdir -p "apps/${APP}/public" \
    && pnpm exec turbo run build --filter="${PKG}"

FROM node:24-alpine
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

ARG APP
# ARG values aren't visible to CMD at runtime — carry the app dir in an ENV.
ENV APP_DIR=apps/${APP}

WORKDIR /app
# The standalone output is traced from the monorepo root, so it recreates the
# repo layout: apps/<APP>/server.js plus a pruned node_modules next to it.
# Static assets and public/ are not traced and must be copied alongside.
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /repo/apps/${APP}/public ./apps/${APP}/public

USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node ${APP_DIR}/server.js"]
