/**
 * Page Object Model for the Onboarding page.
 *
 * Maps to: /onboarding
 *
 * Two-step flow:
 *   Step 1 — Choose type (Individual Creator / Organisation)
 *   Step 2 — Enter details (name, billing email) and submit
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class OnboardingPage extends BasePage {
  // Step 1: Type selection
  readonly welcomeHeading: Locator;
  readonly individualCreatorButton: Locator;
  readonly organisationButton: Locator;

  // Step 2: Details form
  readonly backButton: Locator;
  readonly organisationNameInput: Locator;
  readonly billingEmailInput: Locator;
  readonly createOrganisationButton: Locator;

  // Common
  readonly signOutLink: Locator;
  readonly signedInAsText: Locator;

  constructor(page: Page) {
    super(page);

    // Step 1
    this.welcomeHeading = page.getByRole('heading', {
      name: 'Welcome to Project Brayford',
    });
    this.individualCreatorButton = page.getByTestId(
      'onboarding-type-individual',
    );
    this.organisationButton = page.getByTestId('onboarding-type-organisation');

    // Step 2
    this.backButton = page.getByTestId('onboarding-back-btn');
    this.organisationNameInput = page.getByTestId('onboarding-org-name');
    this.billingEmailInput = page.getByTestId('onboarding-billing-email');
    this.createOrganisationButton = page.getByTestId('onboarding-submit-btn');

    // Common
    this.signOutLink = page.getByTestId('onboarding-signout');
    this.signedInAsText = page.getByText('Signed in as');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/onboarding');
  }

  /**
   * Assert step 1 (type selection) is visible.
   */
  async expectTypeSelectionVisible(): Promise<void> {
    await this.waitForReady();
    await this.welcomeHeading.waitFor({ state: 'visible' });
    await this.individualCreatorButton.waitFor({ state: 'visible' });
    await this.organisationButton.waitFor({ state: 'visible' });
  }

  /**
   * Select "Individual Creator" and proceed to step 2.
   */
  async selectIndividualCreator(): Promise<void> {
    await this.individualCreatorButton.click();
  }

  /**
   * Select "Organisation" and proceed to step 2.
   */
  async selectOrganisation(): Promise<void> {
    await this.organisationButton.click();
  }

  /**
   * Fill in the organisation details form and submit.
   */
  async fillAndSubmit(opts: {
    name?: string;
    email?: string;
  }): Promise<void> {
    if (opts.name !== undefined) {
      await this.organisationNameInput.clear();
      await this.organisationNameInput.fill(opts.name);
    }
    if (opts.email !== undefined) {
      await this.billingEmailInput.clear();
      await this.billingEmailInput.fill(opts.email);
    }
    await this.createOrganisationButton.click();
  }

  /**
   * Complete the full onboarding flow as an individual creator.
   */
  async completeAsIndividual(opts: {
    name: string;
    email: string;
  }): Promise<void> {
    await this.expectTypeSelectionVisible();
    await this.selectIndividualCreator();
    await this.fillAndSubmit(opts);
  }

  /**
   * Complete the full onboarding flow as an organisation.
   */
  async completeAsOrganisation(opts: {
    name: string;
    email: string;
  }): Promise<void> {
    await this.expectTypeSelectionVisible();
    await this.selectOrganisation();
    await this.fillAndSubmit(opts);
  }
}
