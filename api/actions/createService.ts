import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
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
            price: parseFloat(durationPrices![dur].toFixed(2))
          }))
        }
      };

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
      } else {
        throw new Error("Multi-duration product creation failed - no product returned");
      }
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