import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ request, reply, connections, logger }) => {
  try {
    // Get the current shop ID from the Shopify connection context
    const shopId = connections.shopify.currentShopId;
    
    if (!shopId) {
      logger.error("Shop ID not available");
      await reply.code(400).type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Widget Test - Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Booking Widget Test</h1>
          <div class="error">
            <p>Error: Shop ID not available. This route must be accessed from within a Shopify shop context.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Create the HTML page that displays shop ID and loads the booking widget
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking Widget Test</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto;
          }
          .info { 
            background: #f0f8ff; 
            padding: 15px; 
            border-radius: 5px; 
            margin-bottom: 20px;
          }
          .widget-container {
            border: 2px dashed #ccc;
            padding: 20px;
            border-radius: 5px;
            background: #fafafa;
          }
        </style>
      </head>
      <body>
        <h1>Booking Widget Test Page</h1>
        
        <div class="info">
          <h2>Shop Information</h2>
          <p><strong>Shop ID:</strong> ${shopId}</p>
          <p>This page is used to test the booking widget functionality.</p>
        </div>

        <div class="widget-container">
          <h2>Booking Widget</h2>
          <p>The booking widget should load below:</p>
          
          <!-- Placeholder for the booking widget -->
          <div id="booking-widget">
            <p>Loading booking widget...</p>
          </div>
        </div>

        <!-- Load the booking widget script with the shop ID parameter -->
        <script>
          // Widget configuration
          window.bookingWidgetConfig = {
            shopId: '${shopId}',
            apiUrl: '${request.protocol}://${request.hostname}'
          };
          
          // Load the booking widget script
          (function() {
            const script = document.createElement('script');
            script.src = '/booking-widget?shopId=${shopId}';
            script.async = true;
            script.onload = function() {
              console.log('Booking widget script loaded successfully');
            };
            script.onerror = function() {
              console.error('Failed to load booking widget script');
              document.getElementById('booking-widget').innerHTML = 
                '<p style="color: red;">Failed to load booking widget. Please check the console for errors.</p>';
            };
            document.head.appendChild(script);
          })();
        </script>
      </body>
      </html>
    `;

    // Set content type to HTML and send the response
    await reply.type('text/html').send(html);
    
  } catch (error) {
    logger.error("Error in widget test route:", error);
    await reply.code(500).type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Widget Test - Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>Booking Widget Test</h1>
        <div class="error">
          <p>Server Error: Unable to load the widget test page.</p>
        </div>
      </body>
      </html>
    `);
  }
};

export default route;