import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestServices, FakeOfflineSaver } from '../test/fakes';
import { renderApp } from '../test/render';
import type { OfflineStatus } from './offlineSaver';

function openSheet(status: OfflineStatus) {
  const offline = new FakeOfflineSaver(status);
  const rendered = renderApp('/', { services: createTestServices({ offline }) });
  return {
    ...rendered,
    offline,
    open: async () => {
      await rendered.user.click(screen.getByRole('button', { name: 'Play offline' }));
      return screen.getByRole('dialog', { name: 'Play offline' });
    },
    move: (next: OfflineStatus) => act(() => offline.set(next)),
  };
}

describe('Play offline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isn't offered where the browser can't save the app", () => {
    renderApp('/');
    expect(screen.queryByRole('button', { name: 'Play offline' })).not.toBeInTheDocument();
  });

  it('offers to download everything, and says how big it is', async () => {
    const { open, user, offline } = openSheet({ phase: 'idle', saved: 0, total: 1000 });
    const sheet = await open();
    expect(sheet).toHaveFocus();
    expect(within(sheet).queryByRole('progressbar')).not.toBeInTheDocument();

    expect(sheet).toHaveTextContent(/on this device \(\d+\sMB\)/);
    await user.click(within(sheet).getByRole('button', { name: 'Download' }));
    expect(offline.starts).toBe(1);
  });

  it('shows progress while downloading, and can pause', async () => {
    const { open, user, offline, move } = openSheet({ phase: 'idle', saved: 0, total: 1000 });
    const sheet = await open();
    move({ phase: 'downloading', saved: 250, total: 1000 });

    expect(within(sheet).getByRole('progressbar', { name: 'Saved for offline' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(within(sheet).getByText('250 of 1,000 files · 25%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play offline' })).toHaveTextContent('25%');

    await user.click(within(sheet).getByRole('button', { name: 'Pause' }));
    expect(offline.stops).toBe(1);
  });

  it('explains that it is waiting for the internet', async () => {
    const { open } = openSheet({ phase: 'waiting', saved: 10, total: 1000 });
    expect(await open()).toHaveTextContent('Waiting for the internet to come back.');
  });

  it('picks up a download that was stopped part way', async () => {
    const { open, user, offline } = openSheet({ phase: 'idle', saved: 400, total: 1000 });
    const sheet = await open();
    expect(within(sheet).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    await user.click(within(sheet).getByRole('button', { name: 'Keep downloading' }));
    expect(offline.starts).toBe(1);
  });

  it('says why a download failed, and can try again', async () => {
    const { open, user, offline, move } = openSheet({
      phase: 'failed',
      problem: 'network',
      saved: 990,
      total: 1000,
    });
    const sheet = await open();
    expect(sheet).toHaveTextContent("Some files didn't download.");
    await user.click(within(sheet).getByRole('button', { name: 'Try again' }));
    expect(offline.starts).toBe(1);

    move({ phase: 'failed', problem: 'space', saved: 500, total: 1000 });
    expect(sheet).toHaveTextContent('This device is out of space.');
  });

  it('checks what is saved before offering anything', async () => {
    const { open } = openSheet({ phase: 'checking', saved: 0, total: 0 });
    const sheet = await open();
    expect(sheet).toHaveTextContent("Checking what's saved…");
    expect(within(sheet).queryAllByRole('button')).toHaveLength(1); // Just "Close".
  });

  it('celebrates when everything is saved', async () => {
    const { open, user } = openSheet({ phase: 'saved', saved: 1000, total: 1000 });
    expect(screen.getByRole('button', { name: 'Play offline' })).toHaveTextContent('✓');
    const sheet = await open();
    expect(sheet).toHaveTextContent('All saved!');
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with the close button, Escape, or a tap outside', async () => {
    const { open, user } = openSheet({ phase: 'idle', saved: 0, total: 1000 });

    await user.click(within(await open()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await open();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const sheet = await open();
    await user.click(within(sheet).getByText(/Save all the games/));
    expect(sheet).toBeInTheDocument();
    await user.click(sheet.parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells iPhone and iPad users to download from the home screen app', async () => {
    vi.stubGlobal('navigator', { ...navigator, standalone: false });
    const { open } = openSheet({ phase: 'idle', saved: 0, total: 1000 });
    expect(await open()).toHaveTextContent('add the games to your Home Screen first');
  });
});
