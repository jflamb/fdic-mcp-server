FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV TRANSPORT=http
ENV PORT=8080

WORKDIR /app

RUN groupadd --system fdicmcp \
  && useradd --system --gid fdicmcp --home-dir /app --shell /usr/sbin/nologin fdicmcp

COPY --chown=fdicmcp:fdicmcp --from=build /app/package.json /app/package-lock.json ./
COPY --chown=fdicmcp:fdicmcp --from=build /app/node_modules ./node_modules
COPY --chown=fdicmcp:fdicmcp --from=build /app/dist ./dist

EXPOSE 8080

USER fdicmcp

CMD ["node", "dist/index.js"]
