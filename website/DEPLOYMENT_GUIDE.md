# 🚀 Deployment Guide

Since you're experiencing OpenSSL issues with local Jekyll, we'll use GitHub's built-in Jekyll support instead. This is actually easier and more reliable!

## Option 1: Deploy to a New Repository (Recommended)

### Step 1: Create a New GitHub Repository
1. Go to [GitHub.com](https://github.com) and create a new repository
2. Name it something like `barbershop-pro-website` or `barbershop-pro-site`
3. Make it public (required for free GitHub Pages)
4. Don't initialize with README, .gitignore, or license

### Step 2: Connect Your Local Repository
```bash
# Add the remote repository (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push your code
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

### Step 4: Your Site is Live! 🎉
Your website will be available at:
`https://YOUR_USERNAME.github.io/REPO_NAME`

## Option 2: Deploy from Subfolder (Same Repository)

If you want to keep the website in the same repository as your barbershop app:

### Step 1: Push to Main Repository
```bash
# Go back to the main project directory
cd ..

# Add and commit the website folder
git add website/
git commit -m "Add Jekyll website"
git push origin main
```

### Step 2: Configure GitHub Pages
1. Go to your main repository settings
2. Scroll to **Pages** section
3. Under **Source**, select **Deploy from a branch**
4. Choose **main** branch and **/website** folder
5. Click **Save**

Your site will be at: `https://YOUR_USERNAME.github.io/barbershop-app`

## 🎯 Benefits of GitHub's Jekyll Support

- ✅ **No local setup required** - GitHub builds everything
- ✅ **Automatic deployment** - Push code, site updates automatically
- ✅ **No OpenSSL issues** - GitHub handles all dependencies
- ✅ **Free hosting** - GitHub Pages is free for public repositories
- ✅ **Custom domain support** - You can use your own domain later

## 📝 Making Changes

After deployment, to update your website:

1. **Edit files** in the `website/` folder
2. **Commit changes**:
   ```bash
   cd website
   git add .
   git commit -m "Update website content"
   git push origin main
   ```
3. **Wait 1-2 minutes** for GitHub to rebuild and deploy
4. **Refresh your site** to see changes

## 🔧 Troubleshooting

### Site Not Loading
- Check that the repository is public
- Verify GitHub Pages is enabled in repository settings
- Wait a few minutes for the initial build to complete

### Changes Not Appearing
- Check the **Actions** tab in your repository for build errors
- Make sure you pushed to the correct branch
- Wait 1-2 minutes for GitHub to rebuild

### Want to Test Locally?
If you fix the OpenSSL issue later, you can use:
```bash
cd website
./serve.sh
```

But GitHub Pages deployment works great without local testing!
