import test from 'node:test';
import assert from 'node:assert/strict';

test('Pages base supports local, renamed, user-site and custom-domain builds', async () => {
  const previousRepository = process.env.GITHUB_REPOSITORY;
  const previousBase = process.env.PAGES_BASE_PATH;
  try {
    const cases = [
      [undefined, undefined, '/Profraesto/'],
      ['example/FacultyPortal', undefined, '/FacultyPortal/'],
      ['example/example.github.io', undefined, '/'],
      ['example/FacultyPortal', '/', '/'],
      ['example/FacultyPortal', '/showcase/', '/showcase/'],
    ];
    for (const [index, [repository, base, expected]] of cases.entries()) {
      if (repository === undefined) delete process.env.GITHUB_REPOSITORY;
      else process.env.GITHUB_REPOSITORY = repository;
      if (base === undefined) delete process.env.PAGES_BASE_PATH;
      else process.env.PAGES_BASE_PATH = base;
      const { default: config } = await import(`../vite.config.js?case=${index}`);
      assert.equal(config.base, expected);
    }
  } finally {
    if (previousRepository === undefined) delete process.env.GITHUB_REPOSITORY;
    else process.env.GITHUB_REPOSITORY = previousRepository;
    if (previousBase === undefined) delete process.env.PAGES_BASE_PATH;
    else process.env.PAGES_BASE_PATH = previousBase;
  }
});
