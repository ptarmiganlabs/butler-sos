# Stage 1: Build
#
# Pinned by digest rather than by tag. `node:24-bookworm-slim` is republished continuously, so
# a bare tag means two builds of the same commit can produce different images, and a regressed
# or compromised base ships without any change here to explain it. Dependabot's docker
# ecosystem keeps the digest current — see .github/dependabot.yml. Both stages use the same
# digest deliberately; bump them together.
FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341 AS build

WORKDIR /nodeapp

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Runtime
FROM node:26-bookworm-slim@sha256:cd565714d4da3e84bfd341e31448f81d47c6362198f152345297c9c1154e6341

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
