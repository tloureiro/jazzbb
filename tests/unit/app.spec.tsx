import { render } from '@solidjs/testing-library';
import App from '../../src/App';

describe('App shell', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it('renders header actions', () => {
    const { getByText, getAllByText } = render(() => <App />);
    expect(getByText('jazzbb')).toBeInTheDocument();
    expect(getByText('Open vault')).toBeInTheDocument();
    expect(getAllByText(/Save/).length).toBeGreaterThan(0);
    expect(getByText('Search')).toBeInTheDocument();
  });
});
