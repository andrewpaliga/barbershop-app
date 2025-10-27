import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { POSRedirect } from '../POSRedirect';

const mockNavigate = vi.fn();

vi.mock('@remix-run/react', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@shopify/app-bridge-react', () => ({
  useAppBridge: () => ({
    getState: () => ({ platform: null }),
  }),
}));

describe('POSRedirect', () => {
  it('renders and does not error', () => {
    render(<POSRedirect />);
    
    // Component should render without errors
    // The component's useEffect handles the POS detection logic
    expect(true).toBe(true);
  });
});

