import { test, expect } from '@playwright/test';

test('End-to-End: Send invitation from Dashboard and verify in Mailpit', async ({ page }) => {
  // 1. Clear any prior messages in Mailpit to start clean
  await fetch('http://localhost:8025/api/v1/messages', { method: 'DELETE' });

  // 2. Go to the main web app
  await page.goto('/');

  const loginButton = page.getByRole('button', { name: /log in|login|sign in/i });
  const loginLink = page.getByRole('link', { name: /log in|login|sign in/i });
  if (await loginButton.isVisible()) {
    await loginButton.click();
  } else if (await loginLink.isVisible()) {
    await loginLink.click();
  }

  // 3. Wait for Keycloak authentication page
  await expect(page).toHaveURL(/.*8080.*realms\/saas-dev.*/);

  // 4. Fill in Keycloak login form
  await page.locator('#username').fill('operator@local.test');
  await page.locator('#password').fill('operator123');
  await page.locator('#kc-login').click();

  // 5. Handle Keycloak's "Update Profile" required action if it appears
  try {
    await page.waitForURL(/.*VERIFY_PROFILE.*/, { timeout: 3000 });
    await page.locator('#firstName').fill('Operator');
    await page.locator('#lastName').fill('Admin');
    await page.locator('input[type="submit"], button[type="submit"]').click();
  } catch {
    // Already verified
  }

  // 6. Confirm we are on the authenticated dashboard
  await expect(page).toHaveURL(/.*localhost:3000.*/);
  await expect(page.getByRole('heading', { name: 'IAM dashboard' })).toBeVisible();

  // 7. Select the Tenant dropdown
  const tenantSelect = page.locator('label:has-text("Tenant") select');
  await expect(tenantSelect).toBeVisible();
  
  await expect(async () => {
    const options = await tenantSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
  }).toPass({ timeout: 5000 });

  const tenantOptions = await tenantSelect.locator('option').all();
  const tenantValue = await tenantOptions[1].getAttribute('value');
  await tenantSelect.selectOption(tenantValue!);

  // 8. Select a Role
  const roleSelect = page.locator('label:has-text("Role") select');
  await expect(async () => {
    const options = await roleSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
  }).toPass({ timeout: 5000 });

  const roleOptions = await roleSelect.locator('option').all();
  const roleValue = await roleOptions[1].getAttribute('value');
  await roleSelect.selectOption(roleValue!);

  // 9. Enter invitee email
  const inviteEmail = `invited-${Date.now()}@local.test`;
  await page.locator('label:has-text("Email") input[type="email"]').fill(inviteEmail);

  // 10. Click Send invitation
  await page.getByRole('button', { name: 'Send invitation' }).click();

  // 11. Assert UI confirmation
  await expect(page.getByRole('status')).toHaveText('Invitation queued');

  // 12. Poll Mailpit API to verify message delivery by mail worker
  let deliveredMessage: any = null;
  await expect(async () => {
    const resp = await fetch('http://localhost:8025/api/v1/messages');
    expect(resp.ok).toBeTruthy();
    const data = await resp.json() as any;
    expect(data.total).toBeGreaterThan(0);
    const found = data.messages.find((m: any) => 
      m.To && m.To.some((to: any) => to.Address === inviteEmail)
    );
    expect(found).toBeDefined();
    deliveredMessage = found;
  }).toPass({ timeout: 15000, intervals: [1000, 2000] });

  // 13. Fetch full email details and assert content
  expect(deliveredMessage.Subject).toContain('Invitation to join a tenant');
  const msgResp = await fetch(`http://localhost:8025/api/v1/message/${deliveredMessage.ID}`);
  expect(msgResp.ok).toBeTruthy();
  const msgData = await msgResp.json() as any;
  
  expect(msgData.Text).toContain('You were invited to join a tenant');
  expect(msgData.Text).toContain('token=');
});
