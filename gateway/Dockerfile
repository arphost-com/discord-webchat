FROM node:20-alpine

WORKDIR /app

# Create non-root user for security (DS002)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source with correct ownership
COPY --chown=nodejs:nodejs src ./src

# Create data directory with correct ownership
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check (DS026)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["node", "src/index.js"]
