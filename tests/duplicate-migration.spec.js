import { test, expect } from '@playwright/test';
import { switchToFlatView, rows } from './helpers.js';

test('removed duplicate movie ids migrate saved watched and priority marks', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('family-movie-watchlist-v1', JSON.stringify({
      v: 3,
      checked: {
        611: { value: true, updatedAt: 10, device: 'legacy-test' }
      },
      priority: {
        614: { value: true, updatedAt: 20, device: 'legacy-test' }
      }
    }));
  });

  await page.goto('/');
  await switchToFlatView(page);

  // The Shelf list is paginated (a11y fix for #74's ~6,282-tab-stop
  // problem), so these titles won't necessarily be on page 1 of the
  // unfiltered, default-sorted list. Searching narrows the list down to the
  // handful of matches regardless of where the movie sits in state.order.
  await page.locator('#search').fill('The Jungle Book');
  await expect(page.getByText('The Jungle Book (1967) (1967)')).toHaveCount(0);
  const jungleBook = rows(page).filter({ has: page.locator('.title', { hasText: 'The Jungle Book (1967)' }) });
  await expect(jungleBook).toHaveCount(1);
  await expect(jungleBook.locator('.check')).toHaveClass(/on/);

  await page.locator('#search').fill('Freaky Friday');
  await expect(page.getByText('Freaky Friday (1976) (1976)')).toHaveCount(0);
  const freakyFriday = rows(page).filter({ has: page.locator('.title', { hasText: 'Freaky Friday (1976)' }) });
  await expect(freakyFriday).toHaveCount(1);
  await expect(freakyFriday.locator('.star')).toHaveClass(/on/);
});
