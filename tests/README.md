# Testing Guide

This document provides an overview of the testing setup and how to run tests for the Barbershop App.

## Overview

The project uses [Vitest](https://vitest.dev/) as the test runner and [React Testing Library](https://testing-library.com/react) for React component tests.

## Test Structure

```
tests/
├── setup.ts                 # Test environment setup
├── utils/
│   ├── test-utils.tsx       # Custom render utilities
│   └── mock-api.ts          # Mock API helpers
└── integration/
    └── booking-flow.test.ts # Integration tests

web/
├── components/
│   └── __tests__/           # Component tests
└── routes/
    └── __tests__/           # Route/Page tests

api/
└── actions/
    └── __tests__/           # API action tests
```

## Running Tests

### Run all tests
```bash
yarn test
```

### Run tests in watch mode
```bash
yarn test:watch
```

### Run tests with coverage
```bash
yarn test:coverage
```

## Test Categories

### Unit Tests

#### Component Tests
- Located in `web/components/__tests__/`
- Test individual React components in isolation
- Examples:
  - `AdaptorLink.test.tsx` - Tests link rendering and external/internal detection
  - `FullPageSpinner.test.tsx` - Tests spinner rendering
  - `NavMenu.test.tsx` - Tests navigation menu

#### API Action Tests
- Located in `api/actions/__tests__/`
- Test business logic and API interactions
- Examples:
  - `createService.test.ts` - Tests service creation (single & multi-duration)
  - `fetchProducts.test.ts` - Tests product fetching and filtering
  - `handleProductUpdate.test.ts` - Tests webhook handling

### Integration Tests

#### Workflow Tests
- Located in `tests/integration/`
- Test complete user workflows and end-to-end scenarios
- Examples:
  - `booking-flow.test.ts` - Tests the complete booking flow from service creation to booking

## Test Utilities

### Mock API
```typescript
import { createMockApi, createMockConnections, createMockActionContext } from '../tests/utils/mock-api';

const mockContext = createMockActionContext();
// Use mockContext in your tests
```

### Custom Render
```typescript
import { render, screen } from '../tests/utils/test-utils';

render(<MyComponent />);
```

## Writing Tests

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/utils/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### API Action Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockActionContext } from '../tests/utils/mock-api';

describe('MyAction', () => {
  let mockContext: ReturnType<typeof createMockActionContext>;

  beforeEach(() => {
    mockContext = createMockActionContext();
  });

  it('should handle the action correctly', async () => {
    // Setup mocks
    mockContext.params = { ... };
    mockContext.api.myModel.findMany = vi.fn().mockResolvedValue([...]);
    
    // Run action
    const { run } = await import('../myAction');
    const result = await run(mockContext);
    
    // Assert
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and assertions
4. **Mock External Dependencies**: Mock API calls, external libraries, and browser APIs
5. **Test Edge Cases**: Include tests for error states, empty states, and boundary conditions
6. **Keep Tests Fast**: Avoid unnecessary complexity and heavy operations
7. **Maintain Test Coverage**: Aim for high coverage of critical paths

## Common Patterns

### Mocking Remix/React Router
```typescript
vi.mock('@remix-run/react', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
```

### Mocking Gadget API
```typescript
vi.mock('@gadgetinc/react', () => ({
  useFindMany: () => [{ data: [...], fetching: false }],
  useFindFirst: () => [{ data: {...}, fetching: false }],
}));
```

### Mocking Shopify App Bridge
```typescript
global.Shopify = {
  env: { embedded: false },
} as any;
```

## Troubleshooting

### Tests failing with "Cannot find module"
- Ensure all dependencies are installed: `yarn install`
- Check that test files are in the correct location according to the glob pattern

### Tests timing out
- Check for infinite loops in test code
- Ensure async operations are properly awaited
- Verify mocks are correctly set up

### Coverage not updating
- Run `yarn test:coverage` to regenerate coverage reports
- Check that the files being tested are not in the coverage exclude list

## Contributing

When adding new features:
1. Add corresponding tests
2. Maintain or improve test coverage
3. Follow the existing test patterns and structure
4. Update this README if adding new test utilities or patterns

