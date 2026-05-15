# Content OS — monorepo image. Vite preview reads `../OS` and `../linkedin_influencers/data` from `copy-maker/`.
FROM node:20-bookworm-slim

WORKDIR /app

COPY OS /app/OS
COPY linkedin_influencers/data/outliers_index.json /app/linkedin_influencers/data/outliers_index.json
COPY linkedin_influencers/data/outlier_framework_cache.json /app/linkedin_influencers/data/outlier_framework_cache.json

COPY copy-maker/package.json copy-maker/package-lock.json /app/copy-maker/
WORKDIR /app/copy-maker
RUN npm ci

COPY copy-maker /app/copy-maker
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "scripts/railway-start.mjs"]
