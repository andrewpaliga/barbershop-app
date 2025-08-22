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
      // Single duration: create one simple product without variants field
      const singleProductInput = {
        title: name,
        descriptionHtml: description || "",
        productType: "Service",
        status: "ACTIVE"
        // No variants field! Shopify will create default variant automatically
      };

      const createSingleProductMutation = `
        mutation productCreate($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product {
              id
              title
              handle
              status
              variants(first: 1) {
                nodes {
                  id
                  price
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

      const createSingleProductVariables = {
        product: singleProductInput
      };

      // Create single product
      let createSingleProductResult;
      try {
        const shopify = await connections.shopify.forShopId(shopId);
        createSingleProductResult = await shopify.graphql(createSingleProductMutation, createSingleProductVariables);
      } catch (shopifyError: any) {
        throw new Error(`Failed to create single product: ${shopifyError.message}`);
      }

      const singleProductCreateResult = createSingleProductResult?.productCreate;
      
      if (singleProductCreateResult?.userErrors && singleProductCreateResult.userErrors.length > 0) {
        const errors = singleProductCreateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
        throw new Error(`Failed to create single product: ${errors}`);
      }
      
      if (singleProductCreateResult?.product) {
        createdProduct = singleProductCreateResult.product;
      } else {
        throw new Error("Single product creation failed - no product returned");
      }

      // Now update the default variant's price using productVariantUpdate
      // const defaultVariantId = createdProduct.variants.nodes[0].id;
      
      // const updateVariantMutation = `
      //   mutation productVariantUpdate($input: ProductVariantInput!) {
      //     productVariantUpdate(input: $input) {
      //       productVariant {
      //         id
      //         price
      //       }
      //       userErrors {
      //         field
      //         message
      //       }
      //     }
      //   }
      // `;

      // const updateVariantVariables = {
      //   input: {
      //     id: defaultVariantId,
      //     price: price!.toFixed(2)
      //   }
      // };

      // let updateVariantResult;
      // try {
      //   const shopify = await connections.shopify.forShopId(shopId);
      //   updateVariantResult = await shopify.graphql(updateVariantMutation, updateVariantVariables);
      // } catch (variantError: any) {
      //   throw new Error(`Failed to update variant price: ${variantError.message}`);
      // }

      // const variantUpdateResult = updateVariantResult?.productVariantUpdate;
      
      // if (variantUpdateResult?.userErrors && variantUpdateResult.userErrors.length > 0) {
      //   const errors = variantUpdateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
      //   throw new Error(`Failed to update variant price: ${errors}`);
      // }
      
    } else {
      // Multi duration: create parent product for combined listing
      const parentProductInput = {
        title: name,
        descriptionHtml: description || "",
        productType: "Service",
        status: "ACTIVE",
        combinedListingRole: "PARENT"
      };

      const createParentProductMutation = `
        mutation productCreate($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product {
              id
              title
              handle
              status
              combinedListingRole
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const createParentProductVariables = {
        product: parentProductInput
      };

      // Create parent product for combined listing
      let createParentProductResult;
      try {
        const shopify = await connections.shopify.forShopId(shopId);
        createParentProductResult = await shopify.graphql(createParentProductMutation, createParentProductVariables);
      } catch (shopifyError: any) {
        throw new Error(`Failed to call Shopify API for parent product creation: ${shopifyError.message}`);
      }

      // Handle Shopify API response for parent product creation
      const parentProductCreateResult = createParentProductResult?.productCreate;
      
      if (!parentProductCreateResult) {
        throw new Error("Invalid response from Shopify API for parent product creation");
      }

      // Check for user errors in the response
      if (parentProductCreateResult.userErrors && parentProductCreateResult.userErrors.length > 0) {
        const errors = parentProductCreateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
        throw new Error(`Shopify API errors for parent product creation: ${errors}`);
      }

      // Check if parent product was created successfully
      if (!parentProductCreateResult.product) {
        throw new Error("Parent product creation failed - no product returned from Shopify");
      }

      createdProduct = parentProductCreateResult.product;
      const parentProductId = createdProduct.id;

      // Step 2: Create child products for each duration variant
      for (const dur of durations!) {
        try {
          const priceForDuration = durationPrices![dur] as number;
          const childProductInput = {
            title: `${name} - ${dur} minutes`,
            descriptionHtml: description || "",
            productType: "Service",
            status: "ACTIVE",
            combinedListingRole: "CHILD"
            // No variants field! Set price at product creation if supported
          };

          const createChildProductMutation = `
            mutation productCreate($product: ProductCreateInput!) {
              productCreate(product: $product) {
                product {
                  id
                  title
                  handle
                  status
                  combinedListingRole
                  variants(first: 1) {
                    nodes {
                      id
                      price
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

          const createChildProductVariables = {
            product: childProductInput
          };

          const shopify = await connections.shopify.forShopId(shopId);
          const childProductResult = await shopify.graphql(createChildProductMutation, createChildProductVariables);
          
          const childProductCreateResult = childProductResult?.productCreate;
          
          if (childProductCreateResult?.userErrors && childProductCreateResult.userErrors.length > 0) {
            const errors = childProductCreateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
            throw new Error(`Failed to create child product: ${errors}`);
          }
          
          if (childProductCreateResult?.product) {
            const childProduct = childProductCreateResult.product;
            
            // Update the default variant's price for this child product
            // const childVariantId = childProduct.variants.nodes[0].id;
            
            // const updateChildVariantMutation = `
            //   mutation productVariantUpdate($input: ProductVariantInput!) {
            //     productVariantUpdate(input: $input) {
            //       productVariant {
            //         id
            //         price
            //       }
            //       userErrors {
            //         field
            //         message
            //       }
            //     }
            //   }
            // `;

            // const updateChildVariantVariables = {
            //   input: {
            //     id: childVariantId,
            //     price: priceForDuration.toFixed(2)
            //   }
            // };

            // let updateChildVariantResult;
            // try {
            //   const shopify = await connections.shopify.forShopId(shopId);
            //   updateChildVariantResult = await shopify.graphql(updateChildVariantMutation, updateChildVariantVariables);
            // } catch (childVariantError: any) {
            //   throw new Error(`Failed to update child variant price: ${childVariantError.message}`);
            // }

            // const childVariantUpdateResult = updateChildVariantResult?.productVariantUpdate;
            
            // if (childVariantUpdateResult?.userErrors && childVariantUpdateResult.userErrors.length > 0) {
            //   const errors = childVariantUpdateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
            //   throw new Error(`Failed to update child variant price: ${errors}`);
            // }
            
            childProducts.push(childProduct);
          } else {
            throw new Error("Child product creation failed - no product returned");
          }
          
        } catch (childProductError: any) {
          throw new Error(`Failed to create child product for ${dur} minutes: ${childProductError.message}`);
        }
      }

      // Step 3: Link child products to parent using combinedListingUpdate
      const combinedListingUpdateMutation = `
        mutation combinedListingUpdate(
          $parentProductId: ID!,
          $productsAdded: [ChildProductRelationInput!]!,
          $optionsAndValues: [OptionAndValueInput!]!
        ) {
          combinedListingUpdate(
            parentProductId: $parentProductId,
            productsAdded: $productsAdded,
            optionsAndValues: $optionsAndValues
          ) {
            product {
              combinedListingRole
              combinedListing {
                parentProduct {
                  id
                  title
                  status
                }
                combinedListingChildren(first: 25) {
                  nodes {
                    product {
                      id
                      title
                    }
                    parentVariant {
                      id
                      selectedOptions {
                        name
                        value
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `;

      const combinedListingUpdateVariables = {
        parentProductId: parentProductId,
        productsAdded: childProducts.map(childProduct => ({
          productId: childProduct.id,
          optionValues: [childProduct.title.split(' - ')[1]] // Extract duration from title
        })),
        optionsAndValues: [
          {
            name: "Duration",
            values: durations!.map(dur => ({ name: `${dur} minutes` }))
          }
        ]
      };

      let combinedListingResult;
      try {
        const shopify = await connections.shopify.forShopId(shopId);
        combinedListingResult = await shopify.graphql(combinedListingUpdateMutation, combinedListingUpdateVariables);
      } catch (shopifyError: any) {
        throw new Error(`Failed to update combined listing: ${shopifyError.message}`);
      }

      // Handle combined listing response
      const combinedListingUpdateResult = combinedListingResult?.combinedListingUpdate;
      
      if (combinedListingUpdateResult?.userErrors && combinedListingUpdateResult.userErrors.length > 0) {
        const errors = combinedListingUpdateResult.userErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
        throw new Error(`Shopify API errors for combined listing update: ${errors}`);
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
          namespace: "barbershop",
          key: "is_barber_service",
          value: "true",
          type: "boolean"
        },
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
        message: "Multi duration service product created successfully using combined listings model",
        mode,
        parentProduct: {
          id: createdProduct.id,
          title: createdProduct.title,
          handle: createdProduct.handle,
          combinedListingRole: createdProduct.combinedListingRole
        },
        childProducts: childProducts.map(child => ({
          id: child.id,
          title: child.title,
          price: durationPrices![child.title.split(' - ')[1].replace(' minutes', '')] // Extract duration and get price
        }))
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