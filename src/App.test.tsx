import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const KEY = 'proofkeep:store';
const empty = () => localStorage.setItem(KEY, JSON.stringify({ items: [], warnDays: 60 }));

describe('Proofkeep', () => {
  it('opens with labelled demo items and a summary', () => {
    window.location.hash = '/items';
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(0);
    expect(screen.getByTestId('summary')).toHaveTextContent('Expiring soon');
    expect(screen.getByText(/Showing 1–8 of 11/)).toBeInTheDocument();
  });

  it('shows the empty state and can reload demo items', async () => {
    empty();
    window.location.hash = '/items';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('No items yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load demo items' }));
    expect(screen.getByText(/of 11/)).toBeInTheDocument();
  });

  it('validates, saves an item and shows its coverage', async () => {
    empty();
    window.location.hash = '/add';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Save item' }));
    expect(screen.getByText(/Name the product/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Product name'), 'Blender');
    await user.clear(screen.getByLabelText('Manufacturer warranty (months)'));
    await user.type(screen.getByLabelText('Manufacturer warranty (months)'), '24');
    await user.type(screen.getByLabelText('Price paid'), '80');
    await user.click(screen.getByRole('button', { name: 'Save item' }));
    expect(await screen.findByText('Saved “Blender”.')).toBeInTheDocument();
    expect(screen.getByTestId('days-left')).toHaveTextContent(/7\d\d days left/);
  });

  it('logs a claim and filters the list by status', async () => {
    window.location.hash = '/item/demo-6';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Log claim' }));
    expect(screen.getByText('Describe the fault or issue.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Issue'), 'Lid hinge cracked');
    await user.click(screen.getByRole('button', { name: 'Log claim' }));
    expect(screen.getByText('Lid hinge cracked')).toBeInTheDocument();
    unmount();

    window.location.hash = '/items';
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Status'), 'none');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Garden hose reel')).toBeInTheDocument();
  });

  it('rejects an invalid backup without changing data', async () => {
    window.location.hash = '/items';
    const user = userEvent.setup();
    render(<App />);
    const file = new File(['{"nope":true}'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import JSON backup'), file);
    expect(await screen.findByText(/Import failed/)).toBeInTheDocument();
    expect(screen.getByText(/of 11/)).toBeInTheDocument();
  });
});
