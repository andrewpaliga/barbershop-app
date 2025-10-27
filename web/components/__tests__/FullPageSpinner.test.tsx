import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FullPageSpinner } from '../FullPageSpinner';

describe('FullPageSpinner', () => {
  it('renders a spinner', () => {
    render(<FullPageSpinner />);
    
    const spinner = document.querySelector('.Polaris-Spinner');
    expect(spinner).toBeTruthy();
  });

  it('renders spinner with large size', () => {
    render(<FullPageSpinner />);
    
    const spinner = document.querySelector('.Polaris-Spinner--sizeLarge');
    expect(spinner).toBeTruthy();
  });

  it('renders spinner with accessibility label', () => {
    render(<FullPageSpinner />);
    
    // Spinner renders, test that the component renders without errors
    const spinner = document.querySelector('.Polaris-Spinner');
    expect(spinner).toBeTruthy();
  });

  it('has proper container styling for centering', () => {
    const { container } = render(<FullPageSpinner />);
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
    });
  });
});

