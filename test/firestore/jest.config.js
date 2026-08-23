// Jest config for Firestore security-rules tests. These run against the
// Firestore emulator (started by `npm run test:rules`), separate from the
// Dart test suite.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.rules.test.js'],
  // Generous: this also caps beforeAll, where initializeTestEnvironment loads
  // the rules and intermittently took >15s (failing all 50 tests at once).
  testTimeout: 60000,
};
