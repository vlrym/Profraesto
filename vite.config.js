import { defineConfig } from 'vite';

// Actions supplies the actual repository name, including its capitalization.
// Local builds default to this project's directory name.
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'Profraesto';
export default defineConfig({
  base: process.env.PAGES_BASE_PATH || (repository.endsWith('.github.io') ? '/' : `/${repository}/`),
});
