#!/usr/bin/env node
/**
 * 自主发言 World 的行为冒烟测试（不连 Coopanion，只驱动 World 实例本身）。
 *
 *   node --experimental-transform-types --import "file:///<app>/build/cortico/src/extensions/runtime.ts" scripts/selftalk.test.mjs
 *
 * 覆盖：安静计时触发、重复叫醒、上限（含 0=不限）、使用者活动重置、排队期间作废。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, '..');
const mod = await import(pathToFileURL(join(pkgDir, 'src', 'index.ts')).href);
const def = mod.default;

const dir = mkdtempSync(join(tmpdir(), 'selftalk-test-'));
writeFileSync(join(dir, 'config.json'), JSON.stringify({ language: 'zh' }));

let activities = [];
const pushed = [];
const host = {
  log: { info() {}, warn() {}, error() {}, debug() {}, trace() {}, child() { return this; } },
  pushDeferred(e, opts) { pushed.push({ ...e, opts }); },
  store: { range: () => activities },
  modelFacts: { model: () => 'test', accepts: () => true, contextWindow: () => undefined },
  blob: () => null,
  reportUsage() {},
  llmStalls: async () => 0,
};

// jitter 固定为 0，让时间断言可预测；缺省值的行为另外核对。
const cfg = { ...def.defaults(), jitter: 0 };
const world = def.create({ cfg, timezone: 'Asia/Shanghai', botDir: dir });
const fail = [];
const expect = (cond, label) => { if (!cond) fail.push(label); };

const quiet = cfg.quietMinutes;   // 15 分钟
const repeat = cfg.repeatMinutes; // 25 分钟

try {
  expect(def.defaults().maxRounds === 0, '缺省 maxRounds 为 0（不限）');
  expect(def.defaults().quietMinutes === 15, '缺省 quietMinutes 为 15');

  await world.start(host);

  // 还没到安静时长：不叫醒
  world.lastActivitySeen = Date.now() - 5 * 60_000;
  world.tick();
  expect(pushed.length === 0, '早于安静时长时不叫醒');

  // 安静已满：叫醒一次
  world.lastActivitySeen = Date.now() - (quiet + 2) * 60_000;
  world.tick();
  expect(pushed.length === 1, '安静满后叫醒一次');
  expect(pushed[0].type === 'selftalk.nudge', '事件类型');
  expect(pushed[0].opts?.trigger === 'flush', 'flush 投递');
  expect(pushed[0].origin === 'internal', 'internal 投递');
  const text1 = pushed[0].render();
  expect(typeof text1 === 'string' && text1.includes('分钟') && text1.includes('自主发言'), '叫醒正文（第一次）');
  expect(world.rounds === 1, '计数一');

  // 未到重复间隔：不叫
  world.tick();
  expect(pushed.length === 1, '未到重复间隔不叫醒');

  // 重复间隔到了：再叫一次，正文带「又」
  world.lastNudgeAt = Date.now() - (repeat + 1) * 60_000;
  world.tick();
  expect(pushed.length === 2, '重复间隔后再叫醒');
  expect(pushed[1].render().includes('又安静了'), '叫醒正文（再次）');
  expect(world.rounds === 2, '计数二');

  // maxRounds 0 = 不限：再走几轮仍然叫醒
  for (let i = 0; i < 4; i++) {
    world.lastNudgeAt = Date.now() - (repeat + 1) * 60_000;
    world.tick();
  }
  expect(pushed.length === 6, '0 表示不限，继续叫醒');

  // 设定上限 2：计数已到 2 就不再叫
  cfg.maxRounds = 2;
  world.lastNudgeAt = Date.now() - (repeat + 1) * 60_000;
  world.tick();
  expect(pushed.length === 6, '达到上限后不再叫醒');

  // 调回 0：恢复不限
  cfg.maxRounds = 0;
  world.lastNudgeAt = Date.now() - (repeat + 1) * 60_000;
  world.tick();
  expect(pushed.length === 7, '调回 0 后继续叫醒');

  // 没有数字上限：大值也按上限生效
  cfg.maxRounds = 250;
  world.rounds = 200;
  world.lastNudgeAt = Date.now() - (repeat + 1) * 60_000;
  world.tick();
  expect(pushed.length === 8, '上限可以是任意正数');

  // 间隔浮动对每次间隔都生效：Math.random 固定 0.999、jitter 0.5 → 倍数约 1.4995
  const rnd = Math.random;
  Math.random = () => 0.999;
  cfg.jitter = 0.5;
  world.rounds = 1;
  world.lastNudgeAt = Date.now() - (repeat * 1.499 * 60_000 + 2000);
  world.tick();
  expect(pushed.length === 9, '浮动倍数乘在再次叫醒间隔上');
  world.lastNudgeAt = Date.now() - (repeat * 1.2 * 60_000);
  world.tick();
  expect(pushed.length === 9, '浮动倍数没有达到时不提前叫醒');
  Math.random = rnd;
  cfg.jitter = 0;

  // 使用者说话：重置
  activities = [{ type: 'desktop-pet.message', ts: new Date().toISOString() }];
  world.tick();
  expect(world.rounds === 0, '使用者活动重置计数');
  expect(Date.now() - world.lastActivitySeen < 10_000, '安静计时从活动时刻重算');

  // 排队期间使用者回来了：渲染返回 null（事件作废）
  activities = [];
  world.lastActivitySeen = Date.now() - (quiet + 4) * 60_000;
  world.rounds = 0;
  world.tick();
  const stale = pushed[pushed.length - 1];
  expect(typeof stale.render === 'function', '排队事件可渲染');
  activities = [{ type: 'desktop-pet.message', ts: new Date(Date.now() + 5000).toISOString() }];
  expect(stale.render() === null, '排队期间有活动时作废');
} finally {
  await world.stop();
  rmSync(dir, { recursive: true, force: true });
}

if (fail.length) {
  for (const line of fail) console.error(`FAIL: ${line}`);
  process.exit(1);
}
console.log('selftalk behaviour test passed');
