import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. Capture Keycloak Login screen
  await page.goto('http://localhost:8080/realms/Test-Realm/protocol/openid-connect/auth?response_type=code&client_id=web-bff&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback');
  await page.screenshot({ path: 'login-theme-screenshot.png' });
  console.log('Saved login-theme-screenshot.png');

  // 2. Capture Next.js App landing / unauthenticated screen
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page2.goto('http://localhost:3000/dashboard');
  await page2.screenshot({ path: 'dashboard-theme-screenshot.png' });
  console.log('Saved dashboard-theme-screenshot.png');

  await browser.close();
}

main().catch(console.error);
