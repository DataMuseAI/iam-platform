import { test, expect } from '@playwright/test';

test('End-to-End: Sign in via newly created Test-Realm', async ({ page }) => {
  // 1. Navigate to the main web application
  await page.goto('/');

  // 2. Click Sign In if present
  const loginButton = page.getByRole('button', { name: /log in|login|sign in/i });
  const loginLink = page.getByRole('link', { name: /log in|login|sign in/i });

  if (await loginButton.isVisible()) {
    await loginButton.click();
  } else if (await loginLink.isVisible()) {
    await loginLink.click();
  }

  // 3. Confirm we are on Keycloak's Test-Realm authentication page
  await expect(page).toHaveURL(/.*8080.*realms\/Test-Realm.*/);

  // 4. Log in using testuser created in Test-Realm
  await page.locator('#username').fill('testuser');
  await page.locator('#password').fill('testpassword123');
  await page.locator('#kc-login').click();

  // 5. Handle Keycloak's Update Profile if it appears on first login
  try {
    await page.waitForURL(/.*VERIFY_PROFILE.*/, { timeout: 3000 });
    await page.locator('#firstName').fill('Test');
    await page.locator('#lastName').fill('User');
    await page.locator('input[type="submit"], button[type="submit"]').click();
  } catch {
    // Already verified
  }

  // 6. Expect successful redirect back to the Next.js app
  await expect(page).toHaveURL(/.*localhost:3000.*/);
  
  // 7. Verify we are on the authenticated dashboard
  await expect(page.locator('#kc-login')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'IAM dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.screenshot({ path: 'authenticated-dashboard-screenshot.png' });
});
