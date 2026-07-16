# syntax=docker/dockerfile:1

FROM oven/bun:1.3.9-alpine AS build
WORKDIR /workspace

COPY package.json turbo.json tsconfig.base.json ./
COPY clients/web/package.json clients/web/package.json
COPY clients/mobile/package.json clients/mobile/package.json
COPY clients/cli/package.json clients/cli/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/config/package.json packages/config/package.json
COPY server/package.json server/package.json
RUN bun install

COPY clients/web clients/web
COPY packages packages

ARG VITE_API_BASE_URL=http://127.0.0.1:8787
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_CLERK_PUBLISHABLE_KEY=
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN bun run web:build

FROM nginx:1.27-alpine
COPY clients/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/clients/web/dist /usr/share/nginx/html
EXPOSE 8080
