// Jest config for Firestore security-rules tests. These run against the
// Firestore emulator (started by `npm run test:rules`), separate from the
// Dart test suite.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.rules.test.js'],
  // Emulator round-trips are slower than pure-mock tests.
  testTimeout: 15000,
};
