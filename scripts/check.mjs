#!/usr/bin/env node
/**
 * 自言自语插件的本地检查器：不启动 Coopanion，按 `check:extension` 的同一套流程验证。
 *
 *   1. manifest：package.json 的 cortico 块、api 版本、关键字、describe 文件；
 *   2. 干装载（dryMountWorld）：defaults()/create()/tools()/envPromptVars()/webUi() 与配置路径；
 *   3. 自描述：describe.json 与定义导出的必须完全一致（加 --write 时先生成再核对）。
 *
 * 运行方式（cwd 必须是 Coopanion 的 resources/app，tsx 从它的 node_modules 里找）：
 *
 *   node --import tsx --import ".\build\cortico\src\extensions\runtime.ts" "D:\DSH\区1\coopanion-selftalk-plugin\scripts\check.mjs"
 *
 * 加 --write 重写 describe.json。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dryMountWorld } from 'cortico/extensions/dry-mount.ts';
import { checkDescribe, exportDescribe } from 'cortico/extensions/describe-export.ts';
import { parseExtensionManifest } from 'cortico/extensions/manifest.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, '..');
const write = process.argv.includes('--write');

const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const manifest = parseExtensionManifest(pkg);
const problems = [...(manifest.ok ? [] : manifest.reasons)];
const notes = manifest.ok
  ? manifest.warnings.map((w) => `manifest warning: ${w}`)
  : [];

const mod = await import(pathToFileURL(join(pkgDir, 'src', 'index.ts')).href);
const def = mod.default;
const opts = { scratchDir: '', packageDir: pkgDir };

const scratch = mkdtempSync(join(tmpdir(), 'selftalk-check-'));
try {
  const dry = await dryMountWorld(def, { ...opts, scratchDir: scratch, hasWebUiClient: false });
  problems.push(...dry.failures);
  notes.push(...dry.warnings.map((line) => `warning: ${line}`));

  if (write) {
    const file = await exportDescribe('world', def, { ...opts, scratchDir: scratch });
    writeFileSync(join(pkgDir, 'describe.json'), `${JSON.stringify(file, null, 2)}\n`);
    notes.push('describe.json written');
  }

  const described = await checkDescribe('world', def, manifest.ok ? manifest.manifest.describe : undefined, {
    ...opts,
    scratchDir: scratch,
  });
  problems.push(...described.failures);
  notes.push(...described.warnings.map((line) => `warning: ${line}`));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

for (const line of notes) console.log(line);
if (problems.length) {
  for (const line of problems) console.error(`FAIL: ${line}`);
  process.exit(1);
}
console.log('check passed');
