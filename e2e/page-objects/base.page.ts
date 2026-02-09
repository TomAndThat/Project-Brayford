/**
 * Base Page Object Model.
 *
 * Provides shared actions and assertions common to all pages
 * in the creator app (e.g. waiting for loading, checking URL).
 */

import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loadingIndicator = page.getByText('Loading...');
  }

  /**
   * Wait for the initial loading state to resolve.
   */
  async waitForReady(options?: { timeout?: number }): Promise<void> {
    await this.loadingIndicator
      .waitFor({ state: 'hidden', timeout: options?.timeout ?? 10_000 })
      .catch(() => {
        // Loading indicator may never appear if page loads fast
      });
  }

  /**
   * Assert the current URL matches the expected path.
   */
  async expectPath(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${path}$`));
  }

  /**
   * Navigate to a path and wait for loading to finish.
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForReady();
  }
}
