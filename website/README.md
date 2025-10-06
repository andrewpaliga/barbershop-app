# Barbershop Pro - Jekyll Site

This is a Jekyll-powered website for SimplyBook, an appointment booking management app.

## Setup

1. **Navigate to the website directory**:
   ```bash
   cd website
   ```

2. **Install Jekyll** (if not already installed):
   ```bash
   gem install jekyll bundler
   ```

3. **Install dependencies**:
   ```bash
   bundle install
   ```

4. **Serve locally**:
   ```bash
   bundle exec jekyll serve
   ```

5. **View the site**: Open [http://localhost:4000](http://localhost:4000) in your browser.

## GitHub Pages Deployment

This site is configured to work with GitHub Pages. You can deploy it in two ways:

### Option 1: Deploy from the website folder

1. Create a new repository on GitHub
2. Copy only the contents of the `website/` folder to the new repository
3. Push to the `main` branch
4. Go to Settings > Pages
5. Select "Deploy from a branch" and choose `main`
6. Your site will be available at `https://yourusername.github.io/repository-name`

### Option 2: Deploy from a subfolder (if keeping in the same repo)

1. Go to Settings > Pages
2. Select "Deploy from a branch" and choose `main`
3. Set the source to `/website` folder
4. Your site will be available at `https://yourusername.github.io/barbershop-app`

## File Structure

- `_config.yml` - Jekyll configuration
- `_layouts/default.html` - Main layout template
- `index.md` - Homepage content
- `Gemfile` - Ruby dependencies
- `.gitignore` - Git ignore rules

## Customization

- Edit `_config.yml` to change site settings
- Modify `_layouts/default.html` to update the layout
- Update `index.md` to change the homepage content
- Add new pages by creating `.md` files in the root directory

## Features

- Responsive design with Tailwind CSS
- SEO optimized with jekyll-seo-tag
- Social media integration
- Clean, minimal design
- GitHub Pages compatible
