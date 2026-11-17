/**
 * 人读的界面文案（World 名、配置组标题与说明、状态灯），中文与英文两版。
 * 与模型读到的正文（model-text.ts）分开：这里只给控制台看。
 */
import type { Language } from 'cortico/core/language.ts';

/** 状态灯要显示的信息：一段安静走到哪一步、下一次叫醒还有多久、此刻是不是勿扰时段。 */
export interface SelfTalkLampState {
  /** 安静多少分钟后第一次叫醒。 */
  quietMinutes: number;
  /** 一段安静里最多叫醒几次；0 表示不限。 */
  maxRounds: number;
  /** 勿扰时段原文，如 "23:00-08:00"；空串表示没设。 */
  quietWindow: string;
  /** 此刻是否落在勿扰时段里。 */
  inQuietWindow: boolean;
  /** 距离下一次叫醒还有多少分钟；null 表示算不出来（世界还没开始，或已到上限）。 */
  nextMinutes: number | null;
  /** 这一段安静里已经叫醒几次。 */
  rounds: number;
}

export interface SelfTalkUi {
  label: string;
  configTitle: string;
  configDescription: string;
  quietTitle: string;
  quietDescription: string;
  repeatTitle: string;
  repeatDescription: string;
  maxRoundsTitle: string;
  maxRoundsDescription: string;
  jitterTitle: string;
  jitterDescription: string;
  quietHoursTitle: string;
  quietHoursDescription: string;
  backoffTitle: string;
  backoffDescription: string;
  customPromptTitle: string;
  customPromptDescription: string;
  lampLabel: string;
  /** 状态灯悬停说明：下一次叫醒还有多久、本轮第几次、是否勿扰。 */
  lampHint: (state: SelfTalkLampState) => string;
  lampOff: string;
}

const zh: SelfTalkUi = {
  label: '自主发言',
  configTitle: '自主发言',
  configDescription: '安静一段时间后叫醒 Coo，让它自己决定说不说话、做点什么。改这里立即生效。',
  quietTitle: '安静多少分钟后叫醒',
  quietDescription: '没有人跟 Coo 说话多久之后叫醒它一次；0 表示关掉叫醒。',
  repeatTitle: '再次叫醒间隔',
  repeatDescription: '叫醒一次之后还是没有人说话，隔多少分钟再叫醒一次。',
  maxRoundsTitle: '最多叫醒几次',
  maxRoundsDescription: '对方一直不说话时，一段安静里最多叫醒几次；0 表示不限；对方一说话就重新计数。',
  jitterTitle: '间隔浮动',
  jitterDescription: '让每个等待间隔都不那么固定：每个间隔在基准的 1–(1+浮动) 倍之间随机。',
  quietHoursTitle: '勿扰时段',
  quietHoursDescription: '这段时间里不叫醒，例如 23:00-08:00（可跨午夜）；留空表示不设。',
  backoffTitle: '再次叫醒退避',
  backoffDescription: '一直没人说话时逐次拉长间隔：1 表示不变，2 表示每次翻倍；最长 12 小时。',
  customPromptTitle: '自定义提示词',
  customPromptDescription: '附加在每次叫醒正文后面的一段话，写在下面即可；可用 {time} 时刻、{quiet} 安静分钟、{round} 第几次叫醒（{time} 等占位符）。留空表示不加。',
  lampLabel: '叫醒计时',
  lampHint: (s) => {
    if (s.inQuietWindow) return `勿扰中（${s.quietWindow}）：这会儿不叫醒，时段结束后恢复。`;
    if (s.nextMinutes === null) {
      return s.rounds > 0
        ? `在线：本轮已叫醒 ${s.rounds} 次，到了上限，等你回话。`
        : `在线：每安静满 ${s.quietMinutes} 分钟叫醒 Coo 一次。`;
    }
    const cap = s.maxRounds > 0 ? `，最多 ${s.maxRounds} 次` : '，不设次数上限';
    if (s.rounds === 0) return `在线：约 ${s.nextMinutes} 分钟后第一次叫醒${cap}。`;
    return `在线：约 ${s.nextMinutes} 分钟后再次叫醒（本轮第 ${s.rounds + 1} 次${cap}）。`;
  },
  lampOff: '在线：安静计时已关闭。',
};

const en: SelfTalkUi = {
  label: 'Self-talk',
  configTitle: 'Self-talk',
  configDescription: 'After a quiet stretch the app wakes the bot so it can decide for itself whether to speak or do something. Changes apply immediately.',
  quietTitle: 'Wake after quiet minutes',
  quietDescription: 'How long nobody talks to the bot before it is woken once; 0 turns the timer off.',
  repeatTitle: 'Wake again after',
  repeatDescription: 'Minutes before it is woken again when the quiet continues.',
  maxRoundsTitle: 'At most how many wake-ups',
  maxRoundsDescription: 'Wake-ups per quiet stretch; 0 means no limit; talking to the bot starts the count over.',
  jitterTitle: 'Interval jitter',
  jitterDescription: 'Every waiting interval is drawn between 1 and 1+jitter times its base, so the rhythm is never mechanical.',
  quietHoursTitle: 'Quiet hours',
  quietHoursDescription: 'No wake-ups inside this window, for example 23:00-08:00 (may cross midnight); leave empty for none.',
  backoffTitle: 'Wake-up backoff',
  backoffDescription: 'Stretches the wait each time the quiet continues: 1 keeps it, 2 doubles it; capped at 12 hours.',
  customPromptTitle: 'Custom prompt',
  customPromptDescription: 'Appended after every wake-up line; placeholders {time}, {quiet}, {round} are filled in. Leave empty to add nothing.',
  lampLabel: 'Wake timer',
  lampHint: (s) => {
    if (s.inQuietWindow) return `Quiet hours (${s.quietWindow}): no wake-ups until the window ends.`;
    if (s.nextMinutes === null) {
      return s.rounds > 0
        ? `Online: ${s.rounds} wake-up(s) this stretch, limit reached, waiting for you.`
        : `Online: woken once every ${s.quietMinutes} quiet minutes.`;
    }
    const cap = s.maxRounds > 0 ? `, at most ${s.maxRounds} times` : ', without limit';
    if (s.rounds === 0) return `Online: first wake-up in about ${s.nextMinutes} min${cap}.`;
    return `Online: next wake-up in about ${s.nextMinutes} min (wake-up ${s.rounds + 1}${cap}).`;
  },
  lampOff: 'Online: the quiet timer is off.',
};

/** 界面文案语言：zh 与 zh-Hant 用中文，其余（含未指明）用英文，与 Coopanion 的界面语言取法一致。 */
export function uiText(language: Language | undefined): SelfTalkUi {
  return language === 'zh' || language === 'zh-Hant' || language === undefined ? zh : en;
}
