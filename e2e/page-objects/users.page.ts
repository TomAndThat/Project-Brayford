/**
 * Page Object Model for the Users (Team Members) page.
 *
 * Maps to: /dashboard/users
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class UsersPage extends BasePage {
  readonly heading: Locator;
  readonly inviteUserButton: Locator;
  readonly membersTable: Locator;
  readonly emptyState: Locator;
  readonly soloState: Locator;
  readonly rolesInfoBox: Locator;

  // Navigation
  readonly homeButton: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole('heading', { name: 'Team Members' });
    this.inviteUserButton = page.getByTestId('invite-user-btn');
    this.membersTable = page.getByRole('table');
    this.emptyState = page.getByText('No team members found.');
    this.soloState = page.getByText("It's just you for now");
    this.rolesInfoBox = page.getByTestId('roles-info-box');

    this.homeButton = page.getByTestId('home-button');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/dashboard/users');
  }

  /**
   * Assert the users page is fully loaded.
   */
  async expectLoaded(): Promise<void> {
    await this.waitForReady();
    await this.heading.waitFor({ state: 'visible' });
  }

  /**
   * Navigate back to the dashboard via the home button.
   */
  async goBackToDashboard(): Promise<void> {
    await this.homeButton.click();
    await this.page.waitForURL('**/dashboard');
  }
}
