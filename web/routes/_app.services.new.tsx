import React from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  Button,
  InlineStack,
  Text,
  FooterHelp,
  Link,
} from "@shopify/polaris";
import { api } from "../api";

interface ServiceFormData {
  name: string;
  description: string;
  price: number;
  duration: number;
  multiDuration: boolean;
  durationPrices: Record<number, number>;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90];

export default function NewService() {
  const navigate = useNavigate();
  const [fetching, setFetching] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      duration: 30,
      multiDuration: false,
      durationPrices: {},
    },
  });

  const multiDuration = watch("multiDuration");
  const durationPrices = watch("durationPrices");

  const onSubmit = async (formData: ServiceFormData) => {
    try {
      console.log('Form submitted with data:', formData);
      
      let serviceData;
      
      if (formData.multiDuration) {
        // Multi-duration mode: send duration-price pairs
        const durations = Object.keys(formData.durationPrices).map(Number);
        console.log('Multi-duration mode - durations:', durations, 'prices:', formData.durationPrices);
        
        serviceData = {
          name: formData.name,
          description: formData.description,
          durations: durations,
          durationPrices: formData.durationPrices,
        };
      } else {
        // Single duration mode: send single price and duration
        console.log('Single-duration mode - duration:', formData.duration, 'price:', formData.price);
        
        serviceData = {
          name: formData.name,
          description: formData.description,
          price: formData.price,
          duration: formData.duration,
        };
      }
      
      console.log('Submitting service data:', serviceData);
      
      setFetching(true);
      setError(null);
      
      try {
        const result = await api.createService(serviceData);
        console.log('Service creation result:', result);
        
        // Check if the action was successful
        if (result) {
          console.log('Service created successfully, navigating to services');
          navigate("/services");
        }
      } catch (err) {
        console.error('Service creation failed:', err);
        setError(err);
      } finally {
        setFetching(false);
      }
    } catch (err) {
      console.error("Error creating service:", err);
    }
  };

  const handleCancel = () => {
    navigate("/services");
  };

  const handleDurationPriceChange = (duration: number, checked: boolean, price?: number) => {
    const currentPrices = getValues("durationPrices") || {};
    if (checked) {
      const newPrices = { ...currentPrices, [duration]: price || 0 };
      setValue("durationPrices", newPrices);
    } else {
      const { [duration]: removed, ...rest } = currentPrices;
      setValue("durationPrices", rest);
    }
  };

  const updateDurationPrice = (duration: number, price: number) => {
    const currentPrices = getValues("durationPrices") || {};
    const newPrices = { ...currentPrices, [duration]: price };
    setValue("durationPrices", newPrices);
  };

  return (
    <Page
      title="Add New Service"
      backAction={{ content: "Products", onAction: handleCancel }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ 
              backgroundColor: '#d82c0d', 
              color: 'white', 
              padding: '12px 16px', 
              borderRadius: '8px',
              border: '1px solid #d82c0d'
            }}>
              <Text as="p" variant="bodyMd">
                Error creating service: {error.toString()}
              </Text>
            </div>
          )}

          <Card>
            <div style={{ padding: '20px' }}>
              <Text as="h2" variant="headingMd">
                Service Details
              </Text>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: "Service name is required" }}
                  render={({ field }) => (
                    <TextField
                      label="Service Name"
                      autoComplete="off"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.name?.message}
                    />
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Service Description"
                      autoComplete="off"
                      multiline={4}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      helpText="Optional description of the service"
                    />
                  )}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ padding: '20px' }}>
              <Text as="h2" variant="headingMd">
                Pricing & Duration
              </Text>
              
              {!multiDuration ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <Controller
                    name="price"
                    control={control}
                    rules={{ 
                      required: "Service price is required",
                      min: { value: 0.01, message: "Price must be greater than 0" }
                    }}
                    render={({ field }) => (
                      <TextField
                        label="Service Price"
                        type="number"
                        prefix="$"
                        autoComplete="off"
                        value={field.value?.toString() || ""}
                        onChange={(value) => field.onChange(parseFloat(value) || 0)}
                        onBlur={field.onBlur}
                        error={errors.price?.message}
                      />
                    )}
                  />

                  <Controller
                    name="duration"
                    control={control}
                    rules={{ required: "Duration is required" }}
                    render={({ field }) => (
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          Service Duration
                        </Text>
                        <div style={{ marginTop: '8px' }}>
                          <select
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              fontSize: "14px",
                            }}
                          >
                            {DURATION_OPTIONS.map((duration) => (
                              <option key={duration} value={duration}>
                                {duration} minutes
                              </option>
                            ))}
                          </select>
                        </div>
                        {errors.duration && (
                          <div style={{ marginTop: '4px' }}>
                            <Text as="p" variant="bodyMd" tone="critical">
                              {errors.duration.message}
                            </Text>
                          </div>
                        )}
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <Text as="p" variant="bodyMd">
                    Select duration options and set prices for each (at least one is required):
                  </Text>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {DURATION_OPTIONS.map((duration) => (
                      <InlineStack key={duration} gap="300" align="center">
                        <input
                          type="checkbox"
                          id={`duration-${duration}`}
                          checked={duration in (durationPrices || {})}
                          onChange={(e) => {
                            const currentPrice = durationPrices?.[duration] || 0;
                            handleDurationPriceChange(duration, e.target.checked, currentPrice);
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        <label htmlFor={`duration-${duration}`} style={{ marginRight: '8px' }}>
                          {duration} minutes
                        </label>
                        
                        {duration in (durationPrices || {}) && (
                          <TextField
                            label=""
                            type="number"
                            prefix="$"
                            placeholder="0.00"
                            autoComplete="off"
                            value={durationPrices[duration]?.toString() || ""}
                            onChange={(value) => {
                              const numValue = parseFloat(value) || 0;
                              updateDurationPrice(duration, numValue);
                            }}
                            error={
                              durationPrices[duration] !== undefined && 
                              durationPrices[duration] <= 0 
                                ? "Price must be greater than 0" 
                                : undefined
                            }
                          />
                        )}
                      </InlineStack>
                    ))}
                  </div>
                  
                  <Controller
                    name="durationPrices"
                    control={control}
                    rules={{
                      validate: (value) => {
                        if (!value || Object.keys(value).length === 0) {
                          return "At least one duration must be selected";
                        }
                        
                        // Check if all selected durations have valid prices
                        const invalidPrices = Object.entries(value).filter(([_, price]) => 
                          !price || price <= 0
                        );
                        
                        if (invalidPrices.length > 0) {
                          return "All selected durations must have prices greater than 0";
                        }
                        
                        return true;
                      },
                    }}
                    render={() => <div />}
                  />
                  
                  {errors.durationPrices && (
                    <Text as="p" variant="bodyMd" tone="critical">
                      {errors.durationPrices.message}
                    </Text>
                  )}
                </div>
              )}

              <Controller
                name="multiDuration"
                control={control}
                render={({ field }) => (
                  <div style={{ marginTop: '16px' }}>
                    <input
                      type="checkbox"
                      id="multiDuration"
                      checked={field.value}
                      onChange={field.onChange}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor="multiDuration">
                      I want to offer multiple duration options
                    </label>
                  </div>
                )}
              />
            </div>
          </Card>

          {/* Photo upload removed as it's not needed */}

          <div style={{ marginTop: '20px' }}>
            <InlineStack gap="300" align="end">
              <Button onClick={handleCancel}>Cancel</Button>
              <Button
                variant="primary"
                submit
                loading={fetching}
                disabled={fetching}
              >
                Create Service
              </Button>
            </InlineStack>
          </div>
        </div>
      </form>
      <div style={{ marginTop: '16px' }}>
        <FooterHelp>
          Learn more about <Link url="https://shopifybookingapp.com/docs/#services-management">SimplyBook services</Link>.
        </FooterHelp>
      </div>
    </Page>
  );
}