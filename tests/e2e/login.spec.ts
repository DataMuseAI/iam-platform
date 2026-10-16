import { test, expect } from '@playwright/test';

test('End-to-End: Login flow via Keycloak', async ({ page }) => {
  // 1. Go to the main web app
  await page.goto('/');

  // 2. Click the login/signin button or link if it's there
  // (In some Next.js apps, unauthenticated users might be auto-redirected to login)
  const loginButton = page.getByRole('button', { name: /log in|login|sign in/i });
  const loginLink = page.getByRole('link', { name: /log in|login|sign in/i });

  if (await loginButton.isVisible()) {
    await loginButton.click();
  } else if (await loginLink.isVisible()) {
    await loginLink.click();
  }

  // 3. Expect to be redirected to Keycloak authentication page
  await expect(page).toHaveURL(/.*8080.*realms\/saas-dev.*/);

  // 4. Fill in Keycloak login form using the seeded operator account
  await page.locator('#username').fill('operator@local.test');
  await page.locator('#password').fill('operator123');
  
  // 5. Submit the form
  await page.locator('#kc-login').click();

  // 5.1 Handle Keycloak's "Update Profile" required action if it appears
  try {
    // Wait up to 3 seconds to see if we hit the VERIFY_PROFILE page or localhost
    await page.waitForURL(/.*VERIFY_PROFILE.*/, { timeout: 3000 });
    await page.locator('#firstName').fill('Operator');
    await page.locator('#lastName').fill('Admin');
    await page.locator('input[type="submit"], button[type="submit"]').click();
  } catch (e) {
    // Timeout means it likely redirected straight to the app, which is fine
  }

  // 6. Expect to be redirected back to the Next.js app (localhost:3000)
  await expect(page).toHaveURL(/.*localhost:3000.*/);
  
  // 7. Verify we are on the authenticated dashboard
  await expect(page.locator('#kc-login')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'IAM dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
