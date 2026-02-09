/**
 * E2E: Org switcher
 *
 * Validates multi-org switching behaviour in the dashboard.
 *
 * NOTE: The org switcher UI is not yet implemented (dashboard
 * currently loads the first org). These tests are deferred.
 */

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Org switcher', () => {
  test.skip(true, 'Org switcher UI not yet implemented');

  test('org switcher shows all user organisations', async ({ page }) => {
    // TODO: Seed user with multiple org memberships
    // TODO: Assert org switcher dropdown lists all orgs
  });

  test('switching org reloads dashboard data', async ({ page }) => {
    // TODO: Seed two orgs with different brands
    // TODO: Switch org via dropdown
    // TODO: Assert dashboard shows correct org name and brands
  });
});
