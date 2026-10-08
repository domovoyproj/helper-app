const { spawnSync } = require('node:child_process');
const isBun = typeof Bun !== 'undefined' || !!process.versions.bun;
const runner = isBun ? ['bun', ['test']] : ['node', ['--test']];
const files = ['tests/experience.test.cjs', 'tests/kyd-connector.test.cjs'];
const res = spawnSync(runner[0], [...runner[1], ...files], { stdio: 'inherit', shell: false });
process.exit(res ? (res.status ?? 0) : 1);
