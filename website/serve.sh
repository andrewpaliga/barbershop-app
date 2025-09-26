#!/bin/bash

# Barbershop Pro Website - Local Development Server
# This script helps you run the Jekyll site locally

echo "🚀 Starting Barbershop Pro website development server..."
echo ""

# Check if we're in the right directory
if [ ! -f "_config.yml" ]; then
    echo "❌ Error: _config.yml not found. Please run this script from the website/ directory."
    echo "   Current directory: $(pwd)"
    echo "   Expected files: _config.yml, _layouts/, index.md"
    exit 1
fi

# Check if bundle is available
if ! command -v bundle &> /dev/null; then
    echo "❌ Error: Bundler not found. Please install it first:"
    echo "   gem install bundler"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "vendor" ]; then
    echo "📦 Installing dependencies..."
    bundle install
    echo ""
fi

# Start the Jekyll server
echo "🌐 Starting Jekyll server..."
echo "   Site will be available at: http://localhost:4000"
echo "   Press Ctrl+C to stop the server"
echo ""

bundle exec jekyll serve --livereload
