import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock @remix-run/react Link component
vi.mock('@remix-run/react', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import { AdaptorLink } from '../AdaptorLink';

describe('AdaptorLink', () => {
  it('renders an internal link when URL is internal', () => {
    const { container } = render(
      <AdaptorLink url="/staff">Staff Page</AdaptorLink>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/staff');
    expect(screen.getByText('Staff Page')).toBeInTheDocument();
  });

  it('renders an external link with target="_blank" and rel="noopener noreferrer" when external is true', () => {
    const { container } = render(
      <AdaptorLink url="https://example.com" external>
        External Link
      </AdaptorLink>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('External Link')).toBeInTheDocument();
  });

  it('renders an external link for URLs starting with http://', () => {
    const { container } = render(
      <AdaptorLink url="http://example.com">
        HTTP Link
      </AdaptorLink>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('http://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders an external link for URLs starting with https://', () => {
    const { container } = render(
      <AdaptorLink url="https://example.com">
        HTTPS Link
      </AdaptorLink>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('renders an external link for URLs starting with //', () => {
    const { container } = render(
      <AdaptorLink url="//example.com">
        Protocol-relative Link
      </AdaptorLink>
    );
    
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('//example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('passes additional props to the link element', () => {
    const onClick = vi.fn();
    render(
      <AdaptorLink url="/test" onClick={onClick} className="test-class">
        Test Link
      </AdaptorLink>
    );
    
    const link = screen.getByText('Test Link');
    expect(link).toBeTruthy();
    expect(link).toHaveClass('test-class');
  });

  it('handles empty URL gracefully', () => {
    render(
      <AdaptorLink url="">Empty URL</AdaptorLink>
    );
    
    expect(screen.getByText('Empty URL')).toBeInTheDocument();
  });
});

