/**
 * ShipConsole Portal - Login Page Object Model (POM)
 * 
 * Handles user authentication, navigation, and session setup for the ShipConsole Cloud Platform.
 */
export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.backToLoginButton = page.getByRole('button', { name: 'Back to Login' });
  }

  /**
   * Navigates to the portal login page and handles unauthorized fallback screens.
   * @param {string} url Portal base URL
   */
  async navigate(url = 'https://sandbox.shipconsole.com/ShipConsole/login') {
    console.log(`[Playwright] Navigating to ${url}...`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    if (await this.backToLoginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[Playwright] "Back to Login" button detected. Navigating to login form...');
      await this.backToLoginButton.click();
    }
  }

  /**
   * Performs user login and verifies navigation to shipping portal page.
   * @param {string} username Portal username
   * @param {string} password Portal password
   */
  
  async login(username = 'JDE_Shipper', password = 'Welcome1@') {
    console.log(`[Playwright] Logging in as user: ${username}...`);

    await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await this.usernameInput.click();
    await this.usernameInput.fill(username);
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle');

    if (!this.page.url().includes('parcel-shipping') && this.page.url().includes('scdocker')) {
      console.log('[Playwright] Navigating to /parcel-shipping after successful login...');
      await this.page.goto('/parcel-shipping', { waitUntil: 'networkidle' });
    }
  }
}
