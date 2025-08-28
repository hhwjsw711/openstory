FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory and set permissions
RUN mkdir -p /workspace && chown -R node:node /workspace
WORKDIR /workspace

# Install pnpm globally first
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files (make sure they're owned by node user)
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Switch to node user for the rest of the operations
USER node

# Install dependencies as node user
RUN pnpm install --frozen-lockfile

CMD ["sleep", "infinity"]