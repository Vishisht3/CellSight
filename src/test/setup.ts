// Test environment setup
// Uses Node.js built-in test runner — no vitest dependency required.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-64-chars-aaaaaaaaaaaaaaaaaaaaaa';
process.env.DEMO_MODE = 'false';
process.env.DATABASE_PATH = ':memory:';
