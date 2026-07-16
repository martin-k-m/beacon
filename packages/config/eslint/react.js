/**
 * Shared ESLint config for Beacon React/Next.js apps.
 */
module.exports = {
  extends: [require.resolve('./base.js')],
  env: {
    browser: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
