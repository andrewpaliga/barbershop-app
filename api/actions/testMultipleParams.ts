export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Testing multiple string parameters", {
    param1: params.param1,
    param2: params.param2,
    param3: params.param3
  });
  
  return {
    success: true,
    receivedParams: {
      param1: params.param1,
      param2: params.param2,
      param3: params.param3
    }
  };
};

export const params = {
  param1: { type: "string" },
  param2: { type: "string" },
  param3: { type: "string" }
};
