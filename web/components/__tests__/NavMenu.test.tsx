import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavMenu } from '../NavMenu';

// Mock @remix-run/react and @shopify/app-bridge-react
vi.mock('@remix-run/react', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('@shopify/app-bridge-react', () => ({
  NavMenu: ({ children }: any) => <nav>{children}</nav>,
}));

vi.mock('@shopify/polaris-icons', () => ({
  SettingsIcon: () => <svg data-testid="settings-icon" />,
}));

describe('NavMenu', () => {
  it('renders navigation menu', () => {
    render(<NavMenu />);
    
    expect(screen.getByText('Shop Information')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Hours of Operation')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders links with correct hrefs', () => {
    render(<NavMenu />);
    
    const shopInfoLink = screen.getByText('Shop Information');
    expect(shopInfoLink).toHaveAttribute('href', '/');
    
    const staffLink = screen.getByText('Staff');
    expect(staffLink).toHaveAttribute('href', '/staff');
    
    const servicesLink = screen.getByText('Services');
    expect(servicesLink).toHaveAttribute('href', '/services');
    
    const hoursLink = screen.getByText('Hours of Operation');
    expect(hoursLink).toHaveAttribute('href', '/hours-of-operation');
    
    const scheduleLink = screen.getByText('Schedule');
    expect(scheduleLink).toHaveAttribute('href', '/schedule');
    
    const settingsLink = screen.getByText('Settings');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('renders home link with rel="home"', () => {
    render(<NavMenu />);
    
    const shopInfoLink = screen.getByText('Shop Information');
    expect(shopInfoLink).toHaveAttribute('rel', 'home');
  });

  it('wraps links in AppBridgeNavMenu', () => {
    const { container } = render(<NavMenu />);
    
    expect(container.querySelector('nav')).toBeTruthy();
  });
});

