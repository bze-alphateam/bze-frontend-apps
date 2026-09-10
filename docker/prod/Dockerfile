# Production image for ONE app of the monorepo. Build from the repo root:
#
#   docker build -f docker/prod/Dockerfile \
#     --build-arg APP=dex --build-arg PKG=bze-dapp-v2 \
#     --secret id=build_env,src=<env file> .
#
#   APP       = directory name under apps/
#   PKG       = that app's package.json "name" (turbo --filter target)
#   build_env = BuildKit secret: the env file `next build` reads as
#               apps/<APP>/.env. Its NEXT_PUBLIC_* values are inlined into the
#               bundle, so they are public by definition. CI takes the file
#               from the private deploy repo (<deploy dir>/build.env); for a
#               local build point it at apps/<APP>/.env.dist or your own file.
#               A secret mount exists only for the duration of its RUN — it is
#               never part of the build context, of an image layer or of the
#               build log. Runtime-only values (SKIP_API_KEY) are NOT baked
#               either — the server injects them via the container environment.

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

ARG APP
ARG PKG
# Next reads apps/<APP>/.env at build time; turbo builds workspace deps first.
# Output tracing copies that .env into the standalone folder — drop it there:
# every value it holds is already inlined into the bundles, and the runtime
# env comes from the container environment, not from a file.
RUN --mount=type=secret,id=build_env,target=/repo/apps/${APP}/.env,required=true \
    mkdir -p "apps/${APP}/public" \
    && pnpm exec turbo run build --filter="${PKG}" \
    && rm -f "apps/${APP}/.next/standalone/apps/${APP}/.env"

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
