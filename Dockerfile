ARG NODE_VERSION=22.22.1
# Version baked into dist/server.js via esbuild's __APP_VERSION__ define.
# The deploy workflow passes the latest published git tag here so /health
# reflects the actual deployed release. Falls back to package.json when
# unset (local builds, CI smoke builds, etc.).
ARG VERSION

FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./
ARG VERSION
ENV BUILD_VERSION=${VERSION}
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm-slim

ENV NODE_ENV=production
ENV TRANSPORT=http
# Cloud Run injects PORT=8080, so the image uses the same container default.
ENV PORT=8080

WORKDIR /app

RUN groupadd --system fdicmcp \
  && useradd --system --gid fdicmcp --home-dir /app --shell /usr/sbin/nologin fdicmcp

COPY --chown=fdicmcp:fdicmcp --from=build /app/package.json /app/package-lock.json ./
COPY --chown=fdicmcp:fdicmcp --from=build /app/node_modules ./node_modules
COPY --chown=fdicmcp:fdicmcp --from=build /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:8080/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

USER fdicmcp

CMD ["node", "dist/index.js"]
