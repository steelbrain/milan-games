import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';
import { createTestServices, type TestServices } from './fakes';

/** Exposes the current route so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

interface RenderOptions {
  readonly services?: TestServices;
  readonly userOptions?: Parameters<typeof userEvent.setup>[0];
}

/** Renders the whole app at `route`, inside its providers and a memory router. */
export function renderApp(
  route: string,
  { services = createTestServices(), userOptions }: RenderOptions = {},
) {
  const user = userEvent.setup(userOptions);
  const result = render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...result, user, services };
}
