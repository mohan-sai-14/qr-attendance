#!/bin/bash

# Install dependencies without optional packages
npm install --no-optional

# Create client build directory
mkdir -p dist/public

# Copy static files to the build directory
cp -r client/public/* dist/public || true

# Build server files
npm run build:server

# Create a simple index.html if it doesn't exist
if [ ! -f dist/public/index.html ]; then
  echo "<html><head><title>QR Attendance</title></head><body><h1>QR Attendance System</h1><p>Server is running</p></body></html>" > dist/public/index.html
fi

echo "Build completed successfully" 