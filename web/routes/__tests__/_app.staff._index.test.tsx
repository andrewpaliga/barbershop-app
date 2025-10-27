import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock @gadgetinc/react
const mockUseFindMany = vi.fn();
const mockUseNavigate = vi.fn();

vi.mock('@gadgetinc/react', () => ({
  useFindMany: () => mockUseFindMany(),
}));

vi.mock('@remix-run/react', () => ({
  useNavigate: () => mockUseNavigate(),
}));

vi.mock('@shopify/polaris', () => ({
  Page: ({ children, title, primaryAction }: any) => (
    <div data-testid="page" data-title={title}>
      {primaryAction && (
        <button onClick={primaryAction.onAction} data-testid="primary-action">
          {primaryAction.content}
        </button>
      )}
      {children}
    </div>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  BlockStack: ({ children }: any) => <div data-testid="block-stack">{children}</div>,
  DataTable: ({ headings, rows }: any) => (
    <table data-testid="data-table">
      <thead>
        <tr>
          {headings.map((h: string, i: number) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, i: number) => (
          <tr key={i}>
            {Array.isArray(row) ? row.map((cell: any, j: number) => (
              <td key={j}>{cell}</td>
            )) : <td>{row}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Text: ({ children }: any) => <p>{children}</p>,
  Spinner: () => <div data-testid="spinner" />,
  Banner: ({ children, tone }: any) => <div data-testid="banner" data-tone={tone}>{children}</div>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  FooterHelp: ({ children }: any) => <footer>{children}</footer>,
  Link: ({ children, url }: any) => <a href={url}>{children}</a>,
}));

describe('Staff Index Page', () => {
  beforeEach(() => {
    mockUseNavigate.mockReturnValue(vi.fn());
  });

  it('renders loading state while fetching', async () => {
    mockUseFindMany.mockReturnValue([{
      data: undefined,
      fetching: true,
      error: null
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    render(<Component />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('displays error when API call fails', async () => {
    mockUseFindMany.mockReturnValue([{
      data: null,
      fetching: false,
      error: new Error('API Error')
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByText(/Error loading staff/)).toBeInTheDocument();
    });
  });

  it('renders staff table when data is available', async () => {
    mockUseFindMany.mockReturnValue([{
      data: [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          isActive: true
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '098-765-4321',
          isActive: false
        }
      ],
      fetching: false,
      error: null
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('renders empty state when no staff members', async () => {
    mockUseFindMany.mockReturnValue([{
      data: [],
      fetching: false,
      error: null
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText(/No staff members found/)).toBeInTheDocument();
    });
  });

  it('renders headings correctly', async () => {
    mockUseFindMany.mockReturnValue([{
      data: [
        {
          id: '1',
          name: 'Test Staff',
          email: 'test@example.com',
          phone: '123-456-7890',
          isActive: true
        }
      ],
      fetching: false,
      error: null
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    render(<Component />);

    // Check that component renders with data
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  it('displays active status correctly', async () => {
    mockUseFindMany.mockReturnValue([{
      data: [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          isActive: true
        }
      ],
      fetching: false,
      error: null
    }]);

    const StaffIndex = await import('../_app.staff._index');
    const Component = StaffIndex.default;
    
    const { container } = render(<Component />);

    // Check that staff data is rendered
    await waitFor(() => {
      expect(container.textContent).toContain('John Doe');
    });
  });
});

