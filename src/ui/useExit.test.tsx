import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DEEPER, useExit } from './useExit';

function Where() {
  return <output>{`${useNavigationType()} ${useLocation().pathname}`}</output>;
}

function Child() {
  const exit = useExit('/parent');
  return (
    <button type="button" onClick={exit}>
      Back
    </button>
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/parent"
          element={
            <Link to="/child" state={DEEPER}>
              Open
            </Link>
          }
        />
        <Route path="/child" element={<Child />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe('useExit', () => {
  it('goes back through history to the screen that opened this one', async () => {
    const user = renderAt('/parent');
    await user.click(screen.getByRole('link', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    // A real "back", so the browser's own Back button can't return to the screen just left.
    expect(screen.getByRole('status')).toHaveTextContent('POP /parent');
  });

  it('replaces the screen when it was opened some other way', async () => {
    const user = renderAt('/child');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('status')).toHaveTextContent('REPLACE /parent');
  });
});
