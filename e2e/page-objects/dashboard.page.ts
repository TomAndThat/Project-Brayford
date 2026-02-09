/**
 * Page Object Model for the Dashboard page.
 *
 * Maps to: /dashboard
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly welcomeHeading: Locator;
  readonly teamMembersCard: Locator;
  readonly eventsCard: Locator;
  readonly analyticsCard: Locator;
  readonly brandsSection: Locator;
  readonly brandsList: Locator;
  readonly noBrandsText: Locator;
  readonly createEventButton: Locator;

  // Header
  readonly headerOrgName: Locator;
  readonly userProfileButton: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    super(page);

    // Main content
    this.welcomeHeading = page.getByRole('heading', {
      name: 'Welcome to your Dashboard!',
    });
    this.teamMembersCard = page.getByTestId('team-members-card');
    this.eventsCard = page.getByTestId('events-card');
    this.analyticsCard = page.getByTestId('analytics-card');
    this.brandsSection = page.getByTestId('brands-section');
    this.brandsList = page.getByTestId('brands-list');
    this.noBrandsText = page.getByText('No brands yet.');
    this.createEventButton = page.getByRole('button', {
      name: /Create Event/,
    });

    // Header elements
    this.headerOrgName = page.getByTestId('header-org-name');
    this.userProfileButton = page.getByTestId('user-profile-btn');
    this.signOutButton = page.getByTestId('header-signout-btn');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/dashboard');
  }

  /**
   * Assert the dashboard is fully loaded with org data.
   */
  async expectLoaded(): Promise<void> {
    await this.waitForReady();
    await this.welcomeHeading.waitFor({ state: 'visible' });
  }

  /**
   * Navigate to the Team Members page via the dashboard card.
   */
  async goToTeamMembers(): Promise<void> {
    await this.teamMembersCard.click();
    await this.page.waitForURL('**/dashboard/users');
  }

  /**
   * Open the user profile dropdown and sign out.
   */
  async signOut(): Promise<void> {
    await this.userProfileButton.click();
    await this.signOutButton.click();
  }
}
