import { registerAs } from '@nestjs/config';

/**
 * Comma-separated list of modules hidden from the webapp,
 * e.g. HIDDEN_MODULES=stripe,subscription,workspaces
 */
export default registerAs('localization', () => ({
  hiddenModules: (process.env.HIDDEN_MODULES || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),
}));
