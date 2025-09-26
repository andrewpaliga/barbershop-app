#!/bin/bash

# Barbershop Pro Website - Deployment Script
# This script helps you deploy the website to GitHub Pages

echo "🚀 Deploying Barbershop Pro website..."
echo ""

# Check if we're in the right directory
if [ ! -f "_config.yml" ]; then
    echo "❌ Error: _config.yml not found. Please run this script from the website/ directory."
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git not found. Please install Git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    echo "   git branch -M main"
    echo "   git remote add origin <your-repo-url>"
    exit 1
fi

# Build the site
echo "🔨 Building Jekyll site..."
bundle exec jekyll build

if [ $? -ne 0 ]; then
    echo "❌ Error: Jekyll build failed. Please fix the errors and try again."
    exit 1
fi

# Add and commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Update website content"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Website deployed successfully!"
    echo "   Your site will be available at your GitHub Pages URL"
    echo "   (Check your repository settings for the exact URL)"
else
    echo "❌ Error: Failed to push to GitHub. Please check your git configuration."
    exit 1
fi
