# Use a lightweight alpine image
FROM alpine:latest

# Install dependencies
RUN apk add --no-cache \
    ca-certificates \
    unzip \
    wget \
    bash \
    tzdata

# Set working directory
WORKDIR /pb

# PocketBase version
ARG PB_VERSION=0.22.8

# Download PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

# Copy hooks (shared logic)
COPY ./pb_hooks /pb/pb_hooks

# Copy static frontend files (pre-built)
# Assuming 'dist' directory exists on the host during build
COPY ./dist /pb/pb_public

# Default environment variables
ENV PB_PORT=8080

# Expose the default port
EXPOSE 8080

# Start PocketBase
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public"]
