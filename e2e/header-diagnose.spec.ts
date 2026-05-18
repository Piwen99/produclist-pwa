import { test } from '@playwright/test';

test('header width diagnosis at 375px', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const header = document.querySelector('header')!;
    const nav = document.querySelector('nav')!;
    const headerChildren = header.querySelector('div > div')!; // the flex row

    return {
      headerWidth: header.scrollWidth,
      headerClient: header.clientWidth,
      headerOverflow: header.scrollWidth - header.clientWidth,
      flexRowWidth: headerChildren.scrollWidth,
      flexRowClient: headerChildren.clientWidth,
      // Measure each child of the flex row
      children: Array.from(headerChildren.children).map((child, i) => {
        const el = child as HTMLElement;
        return {
          index: i,
          tag: el.tagName,
          outerWidth: el.offsetWidth,
          scrollWidth: el.scrollWidth,
          text: el.innerText?.slice(0, 30) || '(no text)',
          overflow: el.scrollWidth > el.offsetWidth ? 'OVERFLOW' : 'ok',
        };
      }),
    };
  });

  console.log('\n=== HEADER DIAGNOSTIC ===');
  console.log(`Header: scroll=${info.headerWidth}px, client=${info.headerClient}px, overflow=${info.headerOverflow}px`);
  console.log(`Flex row: scroll=${info.flexRowWidth}px, client=${info.flexRowClient}px`);
  console.log('\nChildren:');
  info.children.forEach(c => {
    console.log(`  [${c.index}] ${c.tag} "${c.text}" outer=${c.outerWidth}px scroll=${c.scrollWidth}px ${c.overflow}`);
  });
  console.log('=== END ===\n');
});
