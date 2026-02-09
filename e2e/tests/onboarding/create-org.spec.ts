/**
 * E2E: Onboarding — Create Organisation (Flow A)
 *
 * Validates the complete onboarding flow for a new user who
 * creates their own organisation.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { OnboardingPage } from '../../page-objects/onboarding.page';

test.describe('Onboarding — Create Organisation', () => {
  test('new user is directed to onboarding', async ({
    newUserPage: { page },
  }) => {
    // New user (no org) should end up at onboarding
    await page.goto('/dashboard');
    await page.waitForURL('**/onboarding');

    const onboarding = new OnboardingPage(page);
    await onboarding.expectTypeSelectionVisible();
  });

  test('user can complete onboarding as individual creator', async ({
    newUserPage: { page, email },
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectTypeSelectionVisible();

    // Step 1: Select Individual Creator
    await onboarding.selectIndividualCreator();

    // Step 2: Form should appear with pre-filled data
    await expect(onboarding.organisationNameInput).toBeVisible();
    await expect(onboarding.billingEmailInput).toBeVisible();
    // Billing email should be pre-filled with user's email
    await expect(onboarding.billingEmailInput).toHaveValue(email);

    // Fill name and submit
    await onboarding.fillAndSubmit({
      name: 'My Solo Brand',
      email,
    });

    // Should redirect to dashboard after creating org
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome to your Dashboard!' }),
    ).toBeVisible();
  });

  test('user can complete onboarding as organisation', async ({
    newUserPage: { page, email },
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectTypeSelectionVisible();

    // Complete as organisation
    await onboarding.completeAsOrganisation({
      name: 'Acme Productions Ltd',
      email: 'billing@acme.com',
    });

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome to your Dashboard!' }),
    ).toBeVisible();
  });

  test('user can go back from step 2 to step 1', async ({
    newUserPage: { page },
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectTypeSelectionVisible();

    // Go to step 2
    await onboarding.selectIndividualCreator();
    await expect(onboarding.organisationNameInput).toBeVisible();

    // Go back to step 1
    await onboarding.backButton.click();
    await onboarding.expectTypeSelectionVisible();
  });

  test('user with existing org skips onboarding', async ({
    authenticatedPage: { page },
  }) => {
    // This user already has an org (seeded by authenticatedPage fixture)
    await page.goto('/onboarding');

    // Should redirect to dashboard since they already have an org
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });
});
