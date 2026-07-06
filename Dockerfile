# Content OS — monorepo image. Vite preview reads from `data/os` and `data/outliers/data`.
FROM node:20-bookworm-slim

WORKDIR /app

COPY data/os /app/data/os
COPY data/outliers/data/outliers_index.json /app/data/outliers/data/outliers_index.json
COPY data/outliers/data/outlier_framework_cache.json /app/data/outliers/data/outlier_framework_cache.json
COPY data/outliers/data/outliers_swipe_catalog.json /app/data/outliers/data/outliers_swipe_catalog.json
COPY data/skills /app/data/skills
COPY data/presentations /app/data/presentations

COPY apps/copy-maker/package.json apps/copy-maker/package-lock.json /app/apps/copy-maker/
WORKDIR /app/apps/copy-maker
RUN npm ci

COPY apps/copy-maker /app/apps/copy-maker
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "scripts/railway-start.mjs"]
