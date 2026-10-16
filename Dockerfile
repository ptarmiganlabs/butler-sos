# Stage 1: Build
#
# Both base images are pinned by digest rather than by tag. Their tags are republished
# continuously, so a bare tag means two builds of the same commit can produce different images,
# and a regressed or compromised base ships without any change here to explain it. Dependabot's
# docker ecosystem keeps both digests current — see .github/dependabot.yml.
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build

WORKDIR /nodeapp

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Runtime
#
# Plain Debian, with only the Node.js binary and the official image's entrypoint copied in from
# the build stage. The Node.js image also carries npm, npx, corepack and yarn, which Butler SOS
# never runs: its dependencies are installed above, and CMD and HEALTHCHECK call node directly.
# Deleting them from a Node.js-based runtime stage would only hide them, because their files stay
# in the base image's layers underneath; starting from Debian keeps them out of the image.
#
# The Node.js binary needs only Debian's C and C++ runtime libraries (libc6, libstdc++6 and
# libgcc-s1), which every slim image has. Keep both stages on the same Debian release, bookworm.
FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587

# Add metadata about the image
LABEL maintainer="Göran Sander mountaindude@ptarmiganlabs.com"
LABEL description="Real-time operational metrics for Qlik Sense Enterprise on Windows."

# Set environment to production
ENV NODE_ENV=production

# The same user as the official Node.js image, with the same uid and gid, so that files Butler SOS
# writes to mounted volumes keep their ownership across the change of base image.
RUN groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

WORKDIR /nodeapp

# Copy only necessary files from build stage
COPY --from=build --chown=node:node /nodeapp/node_modules ./node_modules
COPY --chown=node:node . .

# Use the non-root user created above
USER node

# Set up Docker healthcheck
HEALTHCHECK --interval=12s --timeout=12s --start-period=30s CMD ["node", "src/docker-healthcheck.js"]

# The official Node.js image's entrypoint, kept so that commands behave as they did on that image:
# a command that starts with an option, such as `--version`, is run with node.
ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "src/butler-sos.js"]
