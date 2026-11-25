FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/booking-core/package.json ./packages/booking-core/
RUN npm ci
COPY tsconfig.json ./
COPY packages/booking-core/tsconfig.json ./packages/booking-core/
COPY packages/booking-core/src ./packages/booking-core/src
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ARG APP_SHA=dev
ENV NODE_ENV=production APP_SHA=$APP_SHA PORT=3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --from=build --chown=node:node /app/packages/booking-core/package.json ./packages/booking-core/
COPY --from=build --chown=node:node /app/packages/booking-core/dist ./packages/booking-core/dist
COPY --chown=node:node db ./db
COPY --chown=node:node scripts/container-start.sh ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/ready', {signal: AbortSignal.timeout(2000)}).then(res => { process.exitCode = res.ok ? 0 : 1; }).catch(() => { process.exitCode = 1; })"]
CMD ["sh", "scripts/container-start.sh"]
