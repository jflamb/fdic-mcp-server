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

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
