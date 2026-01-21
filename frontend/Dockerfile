# frontend/Dockerfile

# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve for static file serving
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN adduser -D appuser
USER appuser

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
