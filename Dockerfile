# Use official Puppeteer base image which includes Chrome and necessary dependencies
FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Switch to root to install dependencies
USER root

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Change ownership to pptruser (non-root user provided by the base image)
RUN chown -R pptruser:pptruser /app

# Switch to non-root user for security
USER pptruser

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "src/server.js"]
