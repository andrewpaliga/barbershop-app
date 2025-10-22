---
layout: default
title: SimplyBook App Documentation
description: Complete guide to using the SimplyBook booking app for Shopify stores
---

## Documentation

Welcome to SimplyBook, the comprehensive booking solution for your Shopify store. This guide will walk you through setting up and using all the features of our booking app.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Staff Management](#staff-management)
3. [Services Management](#services-management)
4. [Hours of Operation](#hours-of-operation)
5. [Schedule Management](#schedule-management)
6. [Settings](#settings)
7. [Adding the Booking Widget](#adding-the-booking-widget-to-your-store)
8. [Advanced: Using App Embed Blocks](#advanced-using-app-embed-blocks)
9. [Customer Booking Experience](#customer-booking-experience)
10. [POS Integration](#pos-integration)
11. [Best Practices](#best-practices)
12. [Support](#support)

---

## Getting Started

When you first install SimplyBook, you'll be greeted by a dashboard that guides you through the setup process. The app is organized into **five main sections** accessible from the navigation menu:

| Section | Purpose |
|---------|---------|
| **Staff** | Manage your team members |
| **Services** | Create and manage bookable services |
| **Hours of Operation** | Set business hours and holidays |
| **Schedule** | View and manage appointments |
| **Settings** | Configure app preferences |

---

## Staff Management

The Staff section allows you to create and manage your team members who will provide services.

### Adding Staff Members

**Step-by-step process:**

1. **Navigate to Staff section**  
   - Click on "Staff" in the main navigation  

2. **Add new staff member**  
   - Click **"Add New Staff"** button  

3. **Fill out staff details:**  
   - **Photo**: Upload an avatar (optional)  
   - **Name**: Staff member's full name  
   - **Email**: Contact email address  
   - **Phone**: Phone number  
   - **Title**: Job title (e.g., "Senior Barber", "Stylist")  
   - **Is Active**: ✅ Check this box to make them available for booking  

4. **Create the staff member**  
   - Click **"Submit"** to save

### Setting Staff Availability

Once a staff member is created, you can set their availability:

| Availability Type | Description |
|------------------|-------------|
| **Weekly Schedule** | Set regular working hours for each day of the week |
| **Special Day Availability** | Override regular hours for specific dates |
| **Holiday Management** | Ensure staff aren't booked on holidays |

> **⚠️ Important**: Only active staff members with set availability will appear in the booking widget for customers to select.

---

## Services Management

The Services section shows all your bookable services and allows you to create new ones.

### Creating Services

There are **two ways** to add services to your SimplyBook app:

#### Method 1: Add New Service

**Step-by-step process:**

1. **Navigate to Services section**
   - Click on "Services" in the main navigation

2. **Add new service**
   - Click **"Add Service"** button

3. **Fill out service details:**
   - **Service Name**: Name of the service (e.g., "Haircut", "Beard Trim")
   - **Service Description**: Optional description
   - **Service Price**: Price for the service
   - **Service Duration**: How long the service takes

4. **Create the service**
   - Click **"Submit"** to save

#### Method 2: Convert Existing Products

**Step-by-step process:**

1. **Go to Shopify admin**
   - Navigate to **Products** in your Shopify admin

2. **Edit existing product**
   - Click on any product you want to convert

3. **Change product type**
   - Set the **Product Type** to "Service"

4. **Save changes**
   - The product will automatically appear in your SimplyBook services

### Multiple Duration Services

To sell the same service in different lengths, add a variant option named **"Duration"** to the service, then create one variant for each length. Durations must align with your service interval set in **Settings**. For example, if your interval is 30 minutes, valid durations are 30, 60, 90, or 120. Name each variant using the format **"[minutes] min"** (e.g., "30 min", "60 min").

**Example:**
- Haircut — 30 min ($25)
- Haircut — 60 min ($45)

### Auto-Generate Services

**Quick testing option:**

- Use the **"Add Example Services"** feature to automatically generate sample services with proper durations
- Perfect for testing the app before creating your own services

---

## Hours of Operation

Configure when your business is open and when customers can book appointments.

### Setting Up Locations

**Step-by-step process:**

1. **Navigate to Hours of Operation**
   - Click on "Hours of Operation" in the main navigation

2. **View your locations**
   - You'll see all your Shopify locations listed

3. **Configure each location:**
   - ✅ **Enable/disable service availability**
   - ⏰ **Set working hours** for weekdays and weekends
   - 📅 **Configure individual day schedules**
   - 🎉 **Add holidays and closure dates**

### Holiday Management

The app supports holidays for **USA and Canada**.

**Custom holidays:**
- Add holidays specific to your business
- Perfect for local events or special closures

> **⚠️ Important**: The booking widget will only show available time slots during your configured business hours.

---

## Schedule Management

The Schedule section provides a calendar view similar to Google Calendar for managing appointments.

### Viewing Appointments

| Feature | Description |
|---------|-------------|
| **Weekly View** | See all appointments for the current week |
| **Navigation** | Use arrow buttons to move between weeks |
| **Today Button** | Quickly jump to the current date |

### Managing Appointments

| Action | How to Do It |
|--------|--------------|
| **Manual Booking** | Click on any time slot to create a new appointment |
| **Moving Appointments** | Delete the existing appointment and create a new one |
| **Filtering** | Filter appointments by staff member or service type |

> **📝 Note**: Appointment editing will be available in future updates. For now, delete and recreate appointments to move them.

---

## Settings

Configure app-wide preferences in the Settings section.

### Time Slot Configuration

Set the default time interval for booking slots:

| Interval | Description |
|----------|-------------|
| **15 minutes** | Customers can book 15-minute slots |
| **30 minutes** | Customers can book 30-minute slots |
| **60 minutes** | Customers can book 1-hour slots |
| **90 minutes** | Customers can book 1.5-hour slots |

> **💡 Recommendation**: Set this to your minimum service duration. For example, if your shortest service is 30 minutes, set the interval to 30 minutes.

### Onboarding Settings

- **Reset onboarding**: Go through setup process again
- **Re-enable guide**: Show setup guide for new team members

---

## Adding the Booking Button to Your Store

### Step 1: Open Theme Editor

**Two ways to access the theme editor:**

| Method | Steps |
|--------|-------|
| **From Shopify Admin** | 1. Go to **Online Store** → **Themes**<br>2. Click **"Customize"** on your active theme |
| **From SimplyBook App** | 1. Go to SimplyBook app dashboard<br>2. Click **"Open Theme Editor"** button |

### Step 2: Add the App Block

**Step-by-step process:**

1. **Select section**
   - In the theme editor, click on the section where you want the booking button

2. **Add new section**
   - Click **"Add section"**

3. **Find SimplyBook**
   - Go to the **"Apps"** tab
   - Find and select **"SimplyBook"** from the list

4. **Save changes**
   - Click **"Save"** to apply the changes

![Theme editor — Add SimplyBook app block]({{ '/docs/images/add-app-block.png' | relative_url }})

_In the theme editor, open the Apps tab and select the Booking Button from SimplyBook._

### Step 3: Customize the Widget

**Click on the SimplyBook extension** in your theme to customize:

| Setting | Description |
|---------|-------------|
| **Colors** | Match your store's branding |
| **Padding** | Adjust spacing around the button |
| **Button Text** | Change from default "Book Now" to your preferred text |

---

## Advanced: Using App Embed Blocks

For merchants who want more control over button placement and styling, SimplyBook offers an **App Embed Block** that loads the booking system globally without requiring a visible app block.

### What is an App Embed Block?

An App Embed Block loads SimplyBook's CSS and JavaScript assets on every page of your store, allowing you to add custom booking buttons anywhere in your theme code.

### Step 1: Enable the App Embed

**Step-by-step process:**

1. **Open Theme Editor**
   - Go to **Online Store** → **Themes** → **Customize**

2. **Navigate to App Embeds**
   - In the theme editor, look for **"App embeds"** in the left sidebar
   - This is usually at the bottom of the theme settings

3. **Enable SimplyBook Booking Embed**
   - Find **"SimplyBook Booking Embed"** in the list
   - Toggle it **ON**

4. **Save changes**
   - Click **"Save"** to apply

### Step 2: Add Custom Booking Buttons

Once the embed is enabled, you can add booking buttons anywhere in your theme using these methods:

#### Method 1: Using CSS Classes

Add this HTML anywhere in your theme templates:

```html
<button class="simplybook-booking-btn" data-open-booking-modal>
  Book Now
</button>
```

#### Method 2: Using Data Attributes

For more flexibility, use the data attribute:

```html
<button data-open-booking-modal>
  Schedule Appointment
</button>
```

#### Method 3: Custom Styling

You can style your custom buttons with CSS:

```css
.simplybook-booking-btn {
  background: #007bff;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}

.simplybook-booking-btn:hover {
  background: #0056b3;
}
```

### Troubleshooting

**If your custom buttons aren't working:**

1. **Check App Embed is enabled** - Verify "SimplyBook Booking Embed" is ON in App embeds
2. **Verify CSS classes** - Ensure you're using `simplybook-booking-btn` or `data-open-booking-modal`
3. **Check JavaScript** - Make sure the embed block is loading the required JavaScript
4. **Test in different browsers** - Some themes may have JavaScript conflicts

---

## Customer Booking Experience

### Booking Process

**Complete customer journey:**

1. **Customer clicks "Book Now"** on your store
2. **Modal opens** with two options:
   - **Book by Service**: Choose from available services
   - **Book by Professional**: Choose a specific staff member
3. **Select time slot** from the available grid
4. **Complete booking** with contact information
5. **Booking added to cart** with attributes:
   - Duration
   - Booking time and date
   - Staff member selected

### Checkout Process

| Feature | Description |
|---------|-------------|
| **Add products** | Customers can add other products to their cart |
| **Payment options** | Pay now or pay later (configure in Shopify payment settings) |
| **No shipping** | All services have shipping disabled |
| **Confirmation** | Booking confirmed after successful checkout |

### Pay Later Option

**To enable "pay later" functionality:**

1. **Go to Shopify admin**
   - Navigate to **Settings** → **Payments**

2. **Add manual payment**
   - Add a **Manual payment method**

3. **Name it**
   - Use a customer‑friendly name like **"Pay later"** or **"Pay in store"** so it's clear at checkout.

> **⚠️ Important**    Manual payments don't charge the customer online. You'll collect payment in person on **Shopify POS**.

---

## POS Integration

### Installing the POS Extension

**Step-by-step process:**

1. **Open Shopify POS**
   - Launch the Shopify POS app on your device.

2. **Add a new tile**
   - From the Smart Grid, tap **Add tile**.

3. **Choose App**
   - Select **App** from the tile types.

4. **Find SimplyBook**
   - Choose **SimplyBook** from the list of available apps.

5. **Install extension**
   - Add the App extension to your grid.

> **📝 Note**: You may also want to repeat these steps to add the **App website** tile to your grid for quick access to the full app interface from POS.

### Using the POS Extension

**The POS extension displays:**

| Information | Description |
|-------------|-------------|
| **Upcoming appointments** | Today's scheduled appointments |
| **Recent appointments** | Past appointments for reference |
| **Customer arrival status** | Mark as "arrived" or "not arrived" |
| **Add to cart** | Process unpaid bookings |

### Order Management

**When a customer arrives:**

1. **Select their booking** in the POS
2. **Mark arrival status** as "arrived" or "not arrived"
3. **Add booking to cart**
4. **Add additional products** if needed
5. **Complete checkout**

> **📝 Note**: The app cancels the original online order and creates a new POS order with a reference to maintain proper bookkeeping.

---

## Best Practices

### Service Setup

| Practice | Description |
|----------|-------------|
| **Realistic durations** | Set accurate time estimates for each service |
| **Clear names** | Use descriptive, customer-friendly service names |
| **Helpful descriptions** | Add details that help customers choose |

### Staff Management

| Practice | Description |
|----------|-------------|
| **Keep availability updated** | Regularly update staff schedules |
| **Professional photos** | Use high-quality staff profile images |
| **Appropriate titles** | Set clear job titles for each team member |

### Customer Experience

| Practice | Description |
|----------|-------------|
| **Prominent placement** | Put booking widget on homepage |
| **Match branding** | Customize widget to match store design |
| **Payment options** | Offer both "pay now" and "pay later" |

---

## Support

**If you need help with SimplyBook:**

1. **Check this documentation** first
2. **Use the "View Instructions"** button in the app
3. **Contact support** through the app settings
4. **Visit our help center** for additional resources

---

*This documentation covers SimplyBook version 1.0. Features and interface may be updated in future versions.*


