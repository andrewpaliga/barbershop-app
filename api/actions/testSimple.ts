import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  console.log("=== testSimple action started ===");
  console.log("Params:", params);
  
  return {
    success: true,
    message: "Simple test action worked",
    params: params
  };
};

export const params = {
  test: {
    type: "string"
  }
};

export const options: ActionOptions = {
  returnType: true
};
