# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Navigate to the website directory
```bash
cd website
```

### 2. Install dependencies (if you have Ruby/Jekyll working)
```bash
bundle install
```

### 3. Start the development server
```bash
./serve.sh
```

**OR** if you prefer manual commands:
```bash
bundle exec jekyll serve --livereload
```

## 🌐 View Your Site

Open [http://localhost:4000](http://localhost:4000) in your browser.

## 📁 File Structure

```
website/
├── _config.yml          # Jekyll configuration
├── _layouts/
│   └── default.html     # Main layout template
├── index.md             # Homepage content
├── Gemfile              # Ruby dependencies
├── serve.sh             # Development server script
├── deploy.sh            # Deployment script
└── README.md            # Full documentation
```

## 🚀 Deploy to GitHub Pages

### Option 1: New Repository
1. Create a new GitHub repository
2. Copy all files from `website/` to the new repo
3. Push to `main` branch
4. Enable GitHub Pages in repository settings

### Option 2: Same Repository
1. Push your changes to GitHub
2. Go to repository Settings > Pages
3. Set source to `/website` folder
4. Your site will be live at `https://yourusername.github.io/barbershop-app`

## 🛠️ Troubleshooting

### Ruby/OpenSSL Issues
If you get OpenSSL errors, try:
```bash
# Install OpenSSL via Homebrew
brew install openssl

# Reinstall Ruby with OpenSSL support
rvm reinstall ruby-3.0.0 --with-openssl-dir=$(brew --prefix openssl)
```

### Alternative: Use GitHub's Built-in Jekyll
If local Jekyll doesn't work, you can:
1. Push your files to GitHub
2. GitHub will automatically build and serve the Jekyll site
3. No local setup required!

## 📝 Editing Content

- **Homepage**: Edit `index.md`
- **Styling**: Edit `_layouts/default.html`
- **Site settings**: Edit `_config.yml`
- **New pages**: Create new `.md` files in the root

## 🎨 Customization

The site uses:
- **Jekyll** for static site generation
- **Tailwind CSS** for styling
- **GitHub Pages** for hosting
- **Minimal theme** as base

All styling is in `_layouts/default.html` - modify as needed!
