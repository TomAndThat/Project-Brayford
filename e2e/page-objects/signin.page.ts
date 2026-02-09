/**
 * Page Object Model for the Sign-In page.
 *
 * Maps to: /signin
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SignInPage extends BasePage {
  readonly heading: Locator;
  readonly googleSignInButton: Locator;
  readonly termsText: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Get Started' });
    this.googleSignInButton = page.getByTestId('signin-google-btn');
    this.termsText = page.getByText('By signing in, you agree to our');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/signin');
  }

  /**
   * Assert the sign-in page is fully rendered.
   */
  async expectVisible(): Promise<void> {
    await this.waitForReady();
    await this.heading.waitFor({ state: 'visible' });
  }
}
