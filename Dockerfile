# Stage 1: Build
FROM node:22-bookworm-slim AS build

WORKDIR /nodeapp

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Runtime
FROM node:22-bookworm-slim

# Add metadata about the image
LABEL maintainer="Göran Sander mountaindude@ptarmiganlabs.com"
LABEL description="Real-time operational metrics for Qlik Sense Enterprise on Windows."

# Set environment to production
ENV NODE_ENV=production

WORKDIR /nodeapp

# Copy only necessary files from build stage
COPY --from=build --chown=node:node /nodeapp/node_modules ./node_modules
COPY --chown=node:node . .

# Use the built-in non-root user
USER node

# Set up Docker healthcheck
HEALTHCHECK --interval=12s --timeout=12s --start-period=30s CMD ["node", "src/docker-healthcheck.js"]

CMD ["node", "src/butler-sos.js"]
