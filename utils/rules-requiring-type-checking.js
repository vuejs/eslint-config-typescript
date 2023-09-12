const allRules = require('@typescript-eslint/eslint-plugin').rules

module.exports = Object.entries(allRules)
  .filter(([name, rule]) => rule.meta?.docs?.requiresTypeChecking)
  .map(([name]) => name)
  // This rule does not require type information, but as its source code requires the parserService,
  // it seems to be encountering undefined behavior in `.vue` files
  // https://github.com/typescript-eslint/typescript-eslint/issues/4755#issuecomment-1080961338
  .concat('prefer-optional-chain')
  .map(name => `@typescript-eslint/${name}`)
