const { spawnSync } = require('node:child_process');
// Check if bun is available in PATH or runtime
const isBun = typeof Bun !== 'undefined' || !!process.versions.bun;
let res = null;
try {
  // If bun exists, bun test runs the tests natively and fast
  res = spawnSync('bun', ['test', 'tests/experience.test.cjs', 'tests/kyd-connector.test.cjs'], { stdio: 'inherit', shell: true });
} catch {
  res = null;
}
if (!res || res.status !== 0) {
  res = spawnSync('node', ['--test', 'tests/experience.test.cjs', 'tests/kyd-connector.test.cjs'], { stdio: 'inherit', shell: true });
}
process.exit(res ? (res.status ?? 0) : 1);
