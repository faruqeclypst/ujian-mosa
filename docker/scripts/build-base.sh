#!/bin/bash

# Build the base image
echo "Building PocketBase Base Image..."

# Build from the root directory to access dist/ and pb_hooks/
docker build -t pb-school-base:latest -f ./docker/base-image/Dockerfile .

echo "Build complete."
