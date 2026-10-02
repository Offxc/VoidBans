# Multi-stage build, the final image only contains Next.js's standalone
# output plus the Prisma client, not the full node_modules tree or source.

FROM node:20-alpine AS base
# Prisma's query/schema engines need OpenSSL and Alpine's node image
# doesn't ship it, without this, prisma generate/migrate fail with an
# unhelpful "Could not parse schema engine response" instead of an
# actual libssl error.
RUN apk add --no-cache openssl
RUN corepack enable

# ---- deps: install once, reused by the build stage ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile Next.js + generate the Prisma client ----
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY . .
RUN pnpm --filter @voidbans/web exec prisma generate
RUN pnpm --filter @voidbans/web build

# ---- migrate: one-off container that applies pending Prisma migrations
# before the app starts. Deliberately NOT part of the slim runtime image
# below, Next's standalone output tracing prunes node_modules down to
# only what the running server imports, which excludes the Prisma CLI
# (a dev dependency), so migrations have to run from this fuller stage.
FROM build AS migrate
WORKDIR /app
CMD ["pnpm", "--filter", "@voidbans/web", "exec", "prisma", "migrate", "deploy"]

# ---- runtime: small final image ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Prisma Client's query engine (used on every DB call the running app
# makes, not just migrations) needs this at runtime too.
RUN apk add --no-cache openssl
RUN addgroup -S voidbans && adduser -S voidbans -G voidbans

# .next/standalone already contains a pruned node_modules with exactly
# what's needed to run (Next's output tracing), no separate node_modules
# copy required.
COPY --from=build /app/packages/web/.next/standalone ./
COPY --from=build /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=build /app/packages/web/public ./packages/web/public
COPY --from=build /app/packages/web/prisma ./packages/web/prisma

USER voidbans
EXPOSE 3300
ENV PORT=3300
ENV HOSTNAME=0.0.0.0

CMD ["node", "packages/web/server.js"]
