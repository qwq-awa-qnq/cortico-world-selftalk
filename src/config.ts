/**
 * 自言自语 World 的配置段与 WebUI 配置组。
 *
 * `worlds.selftalk` 是组装层给出的活引用：WebUI 在「模块」页改值时就地写进这个对象，
 * World 每个检查周期现读，所以改完立即生效，不需要重启。
 */
import type { ConfigGroup } from 'cortico/core/config-schema.ts';
import type { Language } from 'cortico/core/language.ts';
import type { WorldSection } from 'cortico/world.ts';
import { uiText } from './ui-text.ts';

/** World id。内置 World 是 console / desktop-pet / coopanion，扩展 World 用不冲突的名字。 */
export const SELFTALK_ID = 'selftalk';

export interface SelfTalkConfigSection extends WorldSection {
  /** 安静多少分钟后第一次叫醒 Coo；0 关闭计时（世界保持挂载但不再叫醒）。 */
  quietMinutes: number;
  /** 一次叫醒之后，若还是没人说话，隔多久再叫醒一次。 */
  repeatMinutes: number;
  /** 一段安静里最多叫醒几次；0 表示不限；使用者一说话就重新计数。 */
  maxRounds: number;
  /** 间隔的随机浮动比例（0–0.5）：实际间隔 = 基准 × (1 + 随机 × jitter)。 */
  jitter: number;
  /** 勿扰时段，如 "23:00-08:00"；空串表示不设。落在时段里不叫醒。 */
  quietHours: string;
  /** 再次叫醒的退避倍数（1–4）：第 n 次再次叫醒的间隔 = repeatMinutes × backoff^(n-1)。 */
  backoff: number;
  /**
   * 自定义提示词：附加在叫醒正文后的一段话，可用 {time} {quiet} {round} {again} 占位符；
   * 留空表示不加。
   */
  customPrompt: string;
}

/** 各键的缺省值；enabled 恒为 false，是否启用由 bot 声明与部署配置决定。 */
export const SELFTALK_DEFAULTS: SelfTalkConfigSection = {
  enabled: false,
  quietMinutes: 15,
  repeatMinutes: 25,
  maxRounds: 0,
  jitter: 0.2,
  quietHours: '',
  backoff: 1,
  customPrompt: '',
};

/** 配置组：出现在自言自语 World 页，改值立即生效（检查周期里现读）。 */
export function selftalkConfigGroup(language: Language): ConfigGroup {
  const t = uiText(language);
  const owner = `world:${SELFTALK_ID}` as const;
  return {
    id: owner,
    owner,
    schema: {
      type: 'object',
      title: t.configTitle,
      description: t.configDescription,
      properties: {
        [`worlds.${SELFTALK_ID}.quietMinutes`]: {
          type: 'integer',
          title: t.quietTitle,
          description: t.quietDescription,
          minimum: 0,
          maximum: 720,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.repeatMinutes`]: {
          type: 'integer',
          title: t.repeatTitle,
          description: t.repeatDescription,
          minimum: 1,
          maximum: 720,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.maxRounds`]: {
          type: 'integer',
          title: t.maxRoundsTitle,
          description: t.maxRoundsDescription,
          minimum: 0,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.jitter`]: {
          type: 'number',
          title: t.jitterTitle,
          description: t.jitterDescription,
          minimum: 0,
          maximum: 0.5,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.quietHours`]: {
          type: 'string',
          title: t.quietHoursTitle,
          description: t.quietHoursDescription,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.backoff`]: {
          type: 'number',
          title: t.backoffTitle,
          description: t.backoffDescription,
          minimum: 1,
          maximum: 4,
          'x-hot': true,
        },
        [`worlds.${SELFTALK_ID}.customPrompt`]: {
          type: 'string',
          title: t.customPromptTitle,
          description: t.customPromptDescription,
          'x-hot': true,
        },
      },
    },
  };
}
