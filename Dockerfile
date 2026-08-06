# Stage 1: Build
#
# Pinned by digest rather than by tag. `node:24-bookworm-slim` is republished continuously, so
# a bare tag means two builds of the same commit can produce different images, and a regressed
# or compromised base ships without any change here to explain it. Dependabot's docker
# ecosystem keeps the digest current — see .github/dependabot.yml. Both stages use the same
# digest deliberately; bump them together.
FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS build

WORKDIR /nodeapp

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Runtime
FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03

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
