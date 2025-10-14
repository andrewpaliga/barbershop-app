# Booking Button Setup Guide

SimplyBook offers two ways to add booking functionality to your store:

## Option 1: App Block (Recommended for Most Users)

**Best for:** Merchants who want a simple, visual setup

1. Go to **Online Store** → **Themes** → **Customize**
2. Add a section (like header, footer, or any page)
3. Click **Add block** → **Apps** → **SimplyBook Booking Button**
4. Customize the button appearance and settings
5. Save

✅ **Pros:** Easy visual setup, no coding required  
❌ **Cons:** Limited to where you can place the app block

## Option 2: App Embed + Custom Buttons (Advanced)

**Best for:** Merchants who want buttons anywhere in their theme code

### Step 1: Enable the App Embed

1. Go to **Online Store** → **Themes** → **Customize**
2. Click **Theme settings** (gear icon) at the bottom left
3. Scroll to **App embeds**
4. Enable **SimplyBook - Global Booking System**
5. Configure your default button styling and modal appearance
6. Save

### Step 2: Add Booking Buttons Anywhere

Once the embed is enabled, you can add booking buttons anywhere in your theme code:

```html
<!-- Basic booking button -->
<button class="simplybook-booking-btn" data-open-booking-modal>Book Now</button>

<!-- Custom styled booking button -->
<button class="simplybook-booking-btn" data-open-booking-modal style="background: #007bff; padding: 15px 30px;">Schedule Appointment</button>

<!-- As a link -->
<a href="#" class="simplybook-booking-btn" data-open-booking-modal>Book Your Service</a>
```

### Common Places to Add Buttons

**Header Navigation:**
Edit your theme's header file and add the button to your navigation area.

**Product Pages:**
Add booking buttons to product templates for bookable services.

**Homepage:**
Add buttons to hero sections or call-to-action areas.

**Footer:**
Include booking buttons in your footer for easy access.

✅ **Pros:** Complete control over placement and styling  
❌ **Cons:** Requires theme editing knowledge

## Button Customization

### Using CSS Classes

The embed provides a default `.simplybook-booking-btn` class that you can override:

```css
/* Custom button styling */
.simplybook-booking-btn {
  background: linear-gradient(45deg, #007bff, #0056b3);
  border-radius: 25px;
  padding: 12px 24px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

### Inline Styling

Override styles directly on individual buttons:

```html
<button class="simplybook-booking-btn" data-open-booking-modal style="background: #28a745; color: white; border-radius: 8px;">
  Reserve Now
</button>
```

## Examples

### Header Navigation
```html
<nav class="header-nav">
  <a href="/">Home</a>
  <a href="/services">Services</a>
  <button class="simplybook-booking-btn" data-open-booking-modal>Book Now</button>
</nav>
```

### Product Page Call-to-Action
```html
<div class="product-cta">
  <h2>Ready to book this service?</h2>
  <button class="simplybook-booking-btn" data-open-booking-modal style="background: #dc3545; padding: 20px 40px; font-size: 18px;">
    Book This Service
  </button>
</div>
```

### Footer Contact Section
```html
<div class="footer-contact">
  <h3>Get in Touch</h3>
  <p>Ready to book your appointment?</p>
  <button class="simplybook-booking-btn" data-open-booking-modal>Schedule Now</button>
</div>
```

## Troubleshooting

### Button doesn't appear
- Make sure you've enabled the app embed in Theme Settings → App embeds
- Check that your button has the class `simplybook-booking-btn` or attribute `data-open-booking-modal`

### Button appears but doesn't work when clicked
- Verify the app embed is enabled and active
- Check your browser console for JavaScript errors
- Ensure you have services and staff configured in the SimplyBook app

### Styling issues
- Use browser developer tools to inspect the button
- Check if your theme's CSS is overriding the button styles
- Try using `!important` in your custom CSS if needed

## Need Help?

- Visit our documentation: [shopifybookingapp.com/docs](https://shopifybookingapp.com/docs)
- Contact support: hello@shopifybookingapp.com
- Check our setup guide for detailed instructions

## Quick Reference

| Method | Best For | Setup Difficulty | Customization |
|--------|----------|------------------|---------------|
| App Block | Most merchants | Easy | Limited |
| App Embed + Custom | Advanced users | Medium | Complete |
