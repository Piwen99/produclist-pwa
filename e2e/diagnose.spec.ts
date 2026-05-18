import { test, expect } from '@playwright/test';

test.describe('Responsive diagnostics', () => {
  test('detect overflow and layout issues', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        viewport: { width: doc.clientWidth, height: doc.clientHeight },
        scroll: { width: doc.scrollWidth, height: doc.scrollHeight },
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
        overflowX: getComputedStyle(doc).overflowX,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        rootWidth: getComputedStyle(document.getElementById('root') || document.body).width,
        // Check header overflow
        header: (() => {
          const h = document.querySelector('header');
          if (!h) return null;
          return {
            width: h.scrollWidth,
            clientWidth: h.clientWidth,
            overflow: h.scrollWidth > h.clientWidth ? 'OVERFLOW' : 'ok',
          };
        })(),
        // Check nav overflow  
        nav: (() => {
          const n = document.querySelector('nav');
          if (!n) return null;
          return {
            width: n.scrollWidth,
            clientWidth: n.clientWidth,
            overflow: n.scrollWidth > n.clientWidth ? 'OVERFLOW' : 'ok',
          };
        })(),
        // Check main content overflow
        main: (() => {
          const m = document.querySelector('main');
          if (!m) return null;
          return {
            width: m.scrollWidth,
            clientWidth: m.clientWidth,
            overflow: m.scrollWidth > m.clientWidth ? 'OVERFLOW' : 'ok',
          };
        })(),
        // Find any element causing horizontal overflow
        overflowCulprits: (() => {
          const all = document.querySelectorAll('*');
          const culprits: string[] = [];
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.right > doc.clientWidth + 1 && rect.width > 0) {
              const tag = el.tagName.toLowerCase();
              const text = (el as HTMLElement).innerText?.slice(0, 40) || '';
              culprits.push(`${tag}: "${text}" right=${Math.round(rect.right)} width=${Math.round(rect.width)}`);
            }
            if (culprits.length >= 10) break;
          }
          return culprits;
        })(),
      };
    });

    console.log('\n=== LAYOUT DIAGNOSTIC ===');
    console.log(`Viewport: ${info.viewport.width}x${info.viewport.height}`);
    console.log(`Scroll: ${info.scroll.width}x${info.scroll.height}`);
    console.log(`Horizontal overflow: ${info.hasHorizontalOverflow ? '❌ YES' : '✅ No'}`);
    console.log(`html overflow-x: ${info.overflowX}, body overflow-x: ${info.bodyOverflowX}`);
    console.log(`#root width: ${info.rootWidth}`);
    console.log(`Header: ${JSON.stringify(info.header)}`);
    console.log(`Nav: ${JSON.stringify(info.nav)}`);
    console.log(`Main: ${JSON.stringify(info.main)}`);
    if (info.overflowCulprits.length > 0) {
      console.log('\n⚠️  Elements overflowing right edge:');
      info.overflowCulprits.forEach(c => console.log(`  - ${c}`));
    } else {
      console.log('\n✅ No elements overflowing right edge');
    }
    console.log('=== END DIAGNOSTIC ===\n');

    // Also test /cotizador and /historial routes
    for (const route of ['/cotizador', '/historial']) {
      await page.goto(route);
      await page.waitForTimeout(1500);
      
      const routeInfo = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          route,
          viewport: { width: doc.clientWidth, height: doc.clientHeight },
          hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
          header: (() => {
            const h = document.querySelector('header');
            if (!h) return null;
            return { overflow: h.scrollWidth > h.clientWidth ? 'OVERFLOW' : 'ok' };
          })(),
          overflowCulprits: (() => {
            const all = document.querySelectorAll('*');
            const culprits: string[] = [];
            for (const el of all) {
              const rect = el.getBoundingClientRect();
              if (rect.right > doc.clientWidth + 1 && rect.width > 0) {
                const tag = el.tagName.toLowerCase();
                const text = (el as HTMLElement).innerText?.slice(0, 40) || '';
                culprits.push(`${tag}: "${text}"`);
              }
              if (culprits.length >= 10) break;
            }
            return culprits;
          })(),
        };
      });
      console.log(`\n=== ${route} ===`);
      console.log(`Overflow: ${routeInfo.hasHorizontalOverflow ? '❌ YES' : '✅ No'}`);
      console.log(`Header: ${JSON.stringify(routeInfo.header)}`);
      if (routeInfo.overflowCulprits.length > 0) {
        routeInfo.overflowCulprits.forEach(c => console.log(`  ⚠️ ${c}`));
      }
    }

    // Ensure no horizontal overflow in any test
    await page.goto('/');
    await page.waitForTimeout(1000);
    const finalCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(finalCheck).toBe(true);
  });
});
