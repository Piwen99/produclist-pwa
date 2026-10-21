import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

/**
 * Async queries (`findBy*`, `waitFor`) wait for real asynchronous work:
 * a lazy dynamic import, the auth gate resolving, a provider's first load.
 * Under the full suite with coverage and parallel workers, that work can take
 * well over the 1000 ms default on a loaded machine, and the suite goes red
 * without a code change (#102).
 *
 * This raises the wait, not the assertion: a component that never reaches the
 * expected state still fails, just after 5 s instead of 1 s.
 */
configure({ asyncUtilTimeout: 5000 });
