import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    logger.info("🔥🔥🔥 CREATESERVICE ACTION STARTED 🔥🔥🔥");
    
    if (!params) {
      throw new Error("No parameters provided");
    }
    
    const { name, description, photo, duration, price, durations, durationPrices } = params;

    // Validate required fields
    if (!name) {
      throw new Error("Service name is required");
    }

    // Try to get shopId from params first (for testing), then fall back to current shop context
    let shopId;
    
    if (params.shopId) {
      shopId = params.shopId;
    } else {
      shopId = connections.shopify.currentShopId;
    }
    
    if (!shopId) {
      throw new Error("No shop context available - neither params.shopId nor connections.shopify.currentShopId provided");
    }

    let mode;

    // Determine if this is single or multi-duration mode
    if (duration && price !== undefined) {
      // Single mode
      mode = "single";
      
      if (typeof duration !== 'number' || duration <= 0) {
        throw new Error("Duration must be a positive number");
      }
      
      if (typeof price !== 'number' || price < 0) {
        throw new Error("Price must be a non-negative number");
      }

    } else if (durations && durationPrices) {
      // Multi mode
      mode = "multi";
      
      if (!Array.isArray(durations) || durations.length === 0) {
        throw new Error("At least one duration is required");
      }
      
      if (typeof durationPrices !== 'object' || durationPrices === null) {
        throw new Error("Duration prices must be provided as an object");
      }

      // Validate durations are positive numbers
      for (const dur of durations) {
        if (typeof dur !== 'number' || dur <= 0) {
          throw new Error("All durations must be positive numbers");
        }
      }

      // Validate that all durations have corresponding prices and prices are valid
      for (const dur of durations) {
        const priceForDuration = durationPrices[dur];
        if (priceForDuration === undefined || priceForDuration === null) {
          throw new Error(`Price not provided for duration ${dur}`);
        }
        if (typeof priceForDuration !== 'number' || priceForDuration < 0) {
          throw new Error(`Price for duration ${dur} must be a non-negative number`);
        }
      }

    } else {
      throw new Error("Either duration+price (single mode) or durations+durationPrices (multi mode) must be provided");
    }

    let createdProduct;
    let childProducts = [];
    
     if (mode === "single") {
       // Single duration: use productSet to create product with duration option and variant
       const setSingleProductMutation = `
         mutation setProduct($input: ProductSetInput!) {
           productSet(
             synchronous: true,
             input: $input
           ) {
             product {
               id
               title
               handle
               status
               options {
                 id
                 name
                 values
               }
               variants(first: 10) {
                 edges {
                   node {
                     id
                     selectedOptions {
                       name
                       value
                     }
                     price
                   }
                 }
               }
             }
             userErrors {
               field
               message
             }
           }
         }
       `;

       const setSingleProductVariables = {
         input: {
           title: name,
           descriptionHtml: description || "",
           productType: "Service",
           status: "ACTIVE",
           productOptions: [
             {
               name: "Duration",
               values: [
                 { name: `${duration} minutes` }
               ]
             }
           ],
           variants: [
             { 
               optionValues: [{ optionName: "Duration", name: `${duration} minutes` }], 
               price: parseFloat(price!.toFixed(2))
             }
           ]
         }
       };

       // 🚢🚢🚢 SHIPPING DEBUG: Single mode variant input logging 🚢🚢🚢
       logger.info("🚢🚢🚢 SINGLE MODE VARIANT INPUT BEFORE SHOPIFY MUTATION 🚢🚢🚢", {
         variantInput: setSingleProductVariables.input.variants[0],
         hasRequiresShipping: 'requiresShipping' in setSingleProductVariables.input.variants[0],
         requiresShippingValue: (setSingleProductVariables.input.variants[0] as any).requiresShipping,
         variantInputKeys: Object.keys(setSingleProductVariables.input.variants[0])
       });

       // Create single product with variant using productSet
       let setSingleProductResult;
       try {
         const shopify = await connections.shopify.forShopId(shopId);
         setSingleProductResult = await shopify.graphql(setSingleProductMutation, setSingleProductVariables);
       } catch (shopifyError: any) {
         throw new Error(`Failed to create single product with variant: ${shopifyError.message}`);
       }

       const singleProductSetResult = setSingleProductResult?.productSet;
       
       if (singleProductSetResult?.userErrors && singleProductSetResult.userErrors.length > 0) {
         const errors = singleProductSetResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
         throw new Error(`Failed to create single product with variant: ${errors}`);
       }
       
       if (singleProductSetResult?.product) {
         createdProduct = singleProductSetResult.product;
         logger.info("🚀🚀🚀 SINGLE PRODUCT CREATED SUCCESSFULLY 🚀🚀🚀", { productId: createdProduct.id, productTitle: createdProduct.title });
         
         // 🚢🚢🚢 SHIPPING DEBUG: Log created variant properties 🚢🚢🚢
         const createdVariants = createdProduct.variants?.edges || [];
         logger.info("🚢🚢🚢 SINGLE MODE VARIANT RESPONSE FROM SHOPIFY 🚢🚢🚢", {
           variantCount: createdVariants.length,
           variants: createdVariants.map((edge: any) => ({
             variantId: edge.node.id,
             price: edge.node.price,
             selectedOptions: edge.node.selectedOptions,
             hasRequiresShipping: 'requiresShipping' in edge.node,
             requiresShippingValue: edge.node.requiresShipping,
             allNodeKeys: Object.keys(edge.node)
           }))
         });
       } else {
         throw new Error("Single product creation failed - no product returned");
       }
      
     } else {
       // Multi duration: create single product with multiple variants using productSet
       const setMultiProductMutation = `
         mutation setProduct($input: ProductSetInput!) {
           productSet(
             synchronous: true,
             input: $input
           ) {
             product {
               id
               title
               handle
               status
               options {
                 id
                 name
                 values
               }
               variants(first: 10) {
                 edges {
                   node {
                     id
                     selectedOptions {
                       name
                       value
                     }
                     price
                   }
                 }
               }
             }
             userErrors {
               field
               message
             }
           }
         }
       `;

       const setMultiProductVariables = {
         input: {
           title: name,
           descriptionHtml: description || "",
           productType: "Service",
           status: "ACTIVE",
           productOptions: [
             {
               name: "Duration",
               values: durations!.map(dur => ({ name: `${dur} minutes` }))
             }
           ],
           variants: durations!.map(dur => ({
             optionValues: [{ optionName: "Duration", name: `${dur} minutes` }],
             price: parseFloat(Number(durationPrices![dur]).toFixed(2))
           }))
         }
       };

       // 🚢🚢🚢 SHIPPING DEBUG: Multi mode variants input logging 🚢🚢🚢
       logger.info("🚢🚢🚢 MULTI MODE VARIANTS INPUT BEFORE SHOPIFY MUTATION 🚢🚢🚢", {
         variantCount: setMultiProductVariables.input.variants.length,
         variants: setMultiProductVariables.input.variants.map((variant, index) => ({
           variantIndex: index,
           variantInput: variant,
           hasRequiresShipping: 'requiresShipping' in variant,
           requiresShippingValue: (variant as any).requiresShipping,
           variantInputKeys: Object.keys(variant)
         }))
       });

       // Create multi-duration product with variants using productSet
       let setMultiProductResult;
       try {
         const shopify = await connections.shopify.forShopId(shopId);
         setMultiProductResult = await shopify.graphql(setMultiProductMutation, setMultiProductVariables);
       } catch (shopifyError: any) {
         throw new Error(`Failed to create multi-duration product with variants: ${shopifyError.message}`);
       }

       const multiProductSetResult = setMultiProductResult?.productSet;
       
       if (multiProductSetResult?.userErrors && multiProductSetResult.userErrors.length > 0) {
         const errors = multiProductSetResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
         throw new Error(`Failed to create multi-duration product with variants: ${errors}`);
       }
       
       if (multiProductSetResult?.product) {
         createdProduct = multiProductSetResult.product;
         logger.info("🚀🚀🚀 MULTI-DURATION PRODUCT CREATED SUCCESSFULLY 🚀🚀🚀", { productId: createdProduct.id, productTitle: createdProduct.title, variantCount: createdProduct.variants.edges.length });
         
         // 🚢🚢🚢 SHIPPING DEBUG: Log created variant properties 🚢🚢🚢
         const createdVariants = createdProduct.variants?.edges || [];
         logger.info("🚢🚢🚢 MULTI MODE VARIANTS RESPONSE FROM SHOPIFY 🚢🚢🚢", {
           variantCount: createdVariants.length,
           variants: createdVariants.map((edge: any, index: number) => ({
             variantIndex: index,
             variantId: edge.node.id,
             price: edge.node.price,
             selectedOptions: edge.node.selectedOptions,
             hasRequiresShipping: 'requiresShipping' in edge.node,
             requiresShippingValue: edge.node.requiresShipping,
             allNodeKeys: Object.keys(edge.node)
           }))
         });
       } else {
         throw new Error("Multi-duration product creation failed - no product returned");
       }
     }

    // After creation: ensure all variants have requiresShipping set to false (via REST Admin API)
    try {
      const shopifyRest = await connections.shopify.forShopId(shopId);
      const variantEdges = (createdProduct?.variants?.edges || []) as any[];
      const variantIds = variantEdges.map((edge) => edge?.node?.id).filter(Boolean);
 
      logger.info("Starting REST updates for requires_shipping on variants", { count: variantIds.length });
 
      for (const gid of variantIds) {
        const match = typeof gid === 'string' ? gid.match(/\/(\d+)$/) : null;
        const variantNumericId = match?.[1];
        if (!variantNumericId) {
          logger.warn("Skipping variant without numeric ID", { gid });
          continue;
        }
 
        const path = `/admin/api/2025-04/variants/${variantNumericId}.json`;
        const body = { variant: { id: Number(variantNumericId), requires_shipping: false } } as any;
 
        try {
          const resp = await (shopifyRest as any).request('PUT', path, body);
          logger.info("Variant REST update result", { path, status: resp?.statusCode ?? resp?.status ?? 'unknown' });
        } catch (e: any) {
          logger.error("Failed REST update for variant", { path, error: e?.message });
        }
      }
    } catch (e: any) {
      logger.warn(`Variant requiresShipping REST update warning: ${e.message}`);
    }

    // Set metafields on the created product
    const metafieldsMutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldsVariables = {
      metafields: [
        {
          ownerId: createdProduct.id,
          namespace: "booking",
          key: "service_type",
          value: "appointment",
          type: "single_line_text_field"
        }
      ]
    };

    // Set metafields
    let metafieldsResult;
    try {
      const shopify = await connections.shopify.forShopId(shopId);
      metafieldsResult = await shopify.graphql(metafieldsMutation, metafieldsVariables);
    } catch (shopifyError: any) {
      throw new Error(`Failed to set metafields: ${shopifyError.message}`);
    }

     // Handle metafields response
     const metafieldsSetResult = metafieldsResult?.metafieldsSet;
     
     if (metafieldsSetResult?.userErrors && metafieldsSetResult.userErrors.length > 0) {
       const errors = metafieldsSetResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
       throw new Error(`Shopify API errors for metafields: ${errors}`);
     }

     // Publish product to Online Store and POS sales channels
     logger.info("📺📺📺 STARTING SALES CHANNEL PUBLISHING 📺📺📺");
     try {
       logger.info({ productId: createdProduct.id, shopId }, "Starting channel publishing process for product");
       const shopify = await connections.shopify.forShopId(shopId);
       
       // 1. Fetch publication IDs for Online Store and POS
       const getPublicationsQuery = `
         query {
           publications(first: 10) {
             edges {
               node {
                 id
                 name
               }
             }
           }
         }
       `;
       
       logger.info("Executing publications query to fetch available sales channels");
       const publicationsResult = await shopify.graphql(getPublicationsQuery);
       
       logger.info("Raw publications query response:", JSON.stringify(publicationsResult, null, 2));
       
       if (!publicationsResult) {
         logger.error("Publications query returned null/undefined result");
         throw new Error("Failed to fetch publications - no result returned from Shopify GraphQL query");
       }
       
       if (!publicationsResult.publications) {
         logger.error("Publications query result missing 'publications' field:", publicationsResult);
         throw new Error("Invalid publications query response - missing publications field");
       }
       
       const pubs = publicationsResult?.publications?.edges || [];
       logger.info(`Publications query returned ${pubs.length} total publications`);
       
       // Log all available publications with detailed info
       const allPublications = pubs.map((p: any) => ({
         id: p.node.id,
         name: p.node.name,
       }));
       logger.info("All available publications:", allPublications);
       
       // Find Online Store and POS publication IDs
       const onlineStorePub = pubs.find((p: any) => p.node.name === "Online Store");
       const posPub = pubs.find((p: any) => p.node.name === "Point of Sale");
       
       logger.info("Online Store publication search result:", onlineStorePub ? {
         id: onlineStorePub.node.id,
         name: onlineStorePub.node.name
       } : "NOT FOUND");
       
       logger.info("POS publication search result:", posPub ? {
         id: posPub.node.id,
         name: posPub.node.name
       } : "NOT FOUND");
       
       const publicationIds: string[] = [];
       if (onlineStorePub) {
         publicationIds.push(onlineStorePub.node.id);
         logger.info(`✓ Added Online Store publication ID: ${onlineStorePub.node.id}`);
       } else {
         logger.warn("⚠ Online Store publication not found - product will not be available on online storefront");
       }
       
       if (posPub) {
         publicationIds.push(posPub.node.id);
         logger.info(`✓ Added POS publication ID: ${posPub.node.id}`);
       } else {
         logger.warn("⚠ POS publication not found - product will not be available in Point of Sale");
       }
       
       logger.info(`Final publication IDs to publish to: [${publicationIds.join(', ')}]`);
       
       // 2. Publish product to the sales channels
       if (publicationIds.length > 0) {
         const publishProductMutation = `
            mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
              publishablePublish(id: $id, input: $input) {
                userErrors {
                  field
                  message
                }
              }
            }
         `;
         
         const publishVariables = {
           id: createdProduct.id,
           input: publicationIds.map(pubId => ({ publicationId: pubId }))
         };
         
         logger.info("Preparing publishablePublish mutation with variables:", {
           productId: createdProduct.id,
           publicationInputs: publishVariables.input,
           numberOfChannels: publicationIds.length
         });
         
         logger.info("Executing publishablePublish mutation...");
         const publishResult = await shopify.graphql(publishProductMutation, publishVariables);
         
         logger.info("Raw publishablePublish mutation response:", JSON.stringify(publishResult, null, 2));
         
         if (!publishResult) {
           logger.error("publishablePublish mutation returned null/undefined result");
           throw new Error("Failed to publish product - no result returned from publishablePublish mutation");
         }
         
         const publishablePublishResult = publishResult.publishablePublish;
         if (!publishablePublishResult) {
           logger.error("publishablePublish mutation result missing 'publishablePublish' field:", publishResult);
           throw new Error("Invalid publishablePublish mutation response");
         }
         
         const publishErrors = publishablePublishResult.userErrors;
         if (publishErrors && publishErrors.length > 0) {
           logger.error("❌ publishablePublish mutation returned user errors:", publishErrors);
           const errorDetails = publishErrors.map((e: any) => ({
             field: e.field,
             message: e.message,
             code: e.code || 'UNKNOWN'
           }));
           logger.error("Detailed error breakdown:", errorDetails);
           
           const errorMessages = publishErrors.map((e: any) => `${e.field}: ${e.message} (${e.code || 'UNKNOWN'})`).join(', ');
           logger.error(`❌ Channel publishing failed with errors: ${errorMessages}`);
           
           // Don't throw here, just log the errors and continue
           logger.warn("Continuing despite publishing errors - product created but may not be visible in sales channels");
         } else {
           logger.info(`✅ Successfully published product to ${publicationIds.length} sales channels without errors`);
           
           if (publishablePublishResult.publishable?.id) {
             logger.info(`✅ Published product ID confirmed: ${publishablePublishResult.publishable.id}`);
           }
           
           // Log success for each channel
           if (onlineStorePub && publicationIds.includes(onlineStorePub.node.id)) {
             logger.info("✅ Product successfully published to Online Store sales channel");
           }
           if (posPub && publicationIds.includes(posPub.node.id)) {
             logger.info("✅ Product successfully published to POS sales channel");
           }
         }
       } else {
         logger.error("❌ No valid publication IDs found - product will not be available in any sales channels");
         logger.warn("This means the product was created in Shopify but customers cannot purchase it");
         logger.info("Available channel handles found:", pubs.map((p: any) => p.node.channel?.handle).filter(Boolean));
       }
       
       logger.info("✅✅✅ SALES CHANNEL PUBLISHING COMPLETE ✅✅✅");
       
     } catch (e: any) {
       logger.error("❌ Channel publishing process failed with exception:", {
         error: e.message,
         stack: e.stack,
         productId: createdProduct.id,
         shopId
       });
       
       // Provide more specific error context
       if (e.message.includes('GraphQL')) {
         logger.error("GraphQL-related error in publishing - check Shopify API permissions and query syntax");
       } else if (e.message.includes('publications')) {
         logger.error("Publications query failed - check if shop has proper sales channels configured");
       } else if (e.message.includes('publishablePublish')) {
         logger.error("Publishing mutation failed - check product ID and publication IDs validity");
       }
       
       logger.warn("⚠ Product was created but publishing to sales channels failed - manual intervention may be required");
       logger.warn(`⚠ Channel publishing error details: ${e.message}`);
       logger.error("❌❌❌ SALES CHANNEL PUBLISHING FAILED ❌❌❌");
     }

    if (mode === "single") {
      return {
        success: true,
        message: "Single duration service product created successfully",
        mode,
        product: {
          id: createdProduct.id,
          title: createdProduct.title,
          handle: createdProduct.handle,
          price: price
        }
      };
    } else {
      return {
        success: true,
        message: "Multi duration service product created successfully with variants",
        mode,
        product: {
          id: createdProduct.id,
          title: createdProduct.title,
          handle: createdProduct.handle,
          variants: createdProduct.variants.edges.map((edge: any) => ({
            id: edge.node.id,
            duration: edge.node.selectedOptions[0]?.value,
            price: edge.node.price
          }))
        }
      };
    }

  } catch (error) {
    throw error;
  }
};

export const params = {
  name: {
    type: "string"
  },
  description: {
    type: "string"
  },
  photo: {
    type: "object",
    additionalProperties: true
  },
  // Single mode parameters
  duration: {
    type: "number"
  },
  price: {
    type: "number"
  },
  // Multi mode parameters
  durations: {
    type: "array",
    items: {
      type: "number"
    }
  },
  durationPrices: {
    type: "object",
    additionalProperties: true
  },
  // Optional shopId parameter for testing
  shopId: {
    type: "string"
  }
};

export const options: ActionOptions = {
  returnType: true
};