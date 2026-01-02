import { logger } from '../logger.js';

/**
 * Optional plugin: exposes logger on ctx for other plugins.
 * This is safe to load in Node (no browser globals).
 */
export const name = 'logger';

export async function init(ctx = {}) {
  if (!ctx.logger) ctx.logger = logger;
}
