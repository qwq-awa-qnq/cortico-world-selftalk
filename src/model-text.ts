/**
 * 模型读到的文本（叫醒事件正文），中文与英文两版。
 *
 * 语言跟 Coopanion 的模型文本语言走：应用语言是 zh / zh-Hant 用中文，其余用英文。
 * 应用语言从部署目录的 config.json 现读；读不到时按中文。
 */
import { readFileSync } from 'node:fs';

export type ModelLanguage = 'zh' | 'en';

/**
 * config.json 的 `language` → 模型文本语言。
 * 与 Coopanion core/language.ts 的 modelLanguage 同一条规则：zh 与 zh-Hant（以及缺省）用中文，其余用英文。
 */
export function modelLanguageOf(value: unknown): ModelLanguage {
  return value === 'zh' || value === 'zh-Hant' || typeof value !== 'string' ? 'zh' : 'en';
}

/** 从一份部署的 config.json 读应用语言；文件缺失或读不成 JSON 时按中文。 */
export function modelLanguageOfConfigFile(file: string): ModelLanguage {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { language?: unknown };
    return modelLanguageOf(raw.language);
  } catch {
    return 'zh';
  }
}

export interface NudgeLine {
  /** 使用者那边的本地时刻，HH:MM。 */
  at: string;
  /** 这次安静了多久（分钟）。 */
  quietMinutes: number;
  /** 这一段安静里不是第一次叫醒。 */
  again: boolean;
  /** 这一段安静里的第几次叫醒（从 1 起）。 */
  round: number;
}

/**
 * 叫醒事件的正文。开头带时刻，和桌宠事件的习惯一致。
 * 正文只说明「发生了什么、可以怎么做」，开不开口、做什么由 Coo 自己决定。
 * 第三次起换一套说法：一直没人来的时候，最怕的就是它把上一轮的话原样再说一遍。
 * 使用者在 WebUI 里写下的自定义提示词另起一行附在后面（composeNudge）。
 */
export const NUDGE_TEXT: Record<ModelLanguage, (line: NudgeLine) => string> = {
  zh: (line) => {
    if (line.round >= 3) {
      return `[${line.at}] [自主发言] 又安静了大约 ${line.quietMinutes} 分钟，还是没有人来。刚才说过的话不用再说一遍:想换个话题、自己做点别的事都可以;不想说就结束这一轮。`;
    }
    return line.again
      ? `[${line.at}] [自主发言] 又安静了大约 ${line.quietMinutes} 分钟，还是没有人来。想接着刚才的话说下去、自己做点事，或者跟自己聊两句都可以；不想就结束这一轮。`
      : `[${line.at}] [自主发言] 安静了大约 ${line.quietMinutes} 分钟，没有人跟你说话。现在你可以自己决定:想说话就在气泡里跟对方说点什么，想做事就用工具，自己跟自己说几句也可以；不想就结束这一轮。`;
  },
  en: (line) => {
    if (line.round >= 3) {
      return `[${line.at}] [self-talk] Another ${line.quietMinutes} quiet minutes and still nobody has come. No need to repeat what you already said: change the subject, do something else, or end this turn.`;
    }
    return line.again
      ? `[${line.at}] [self-talk] Another ${line.quietMinutes} quiet minutes have passed and nobody has come. You can carry on from where you were, do something on your own, or just talk to yourself a little; if you would rather not, end this turn.`
      : `[${line.at}] [self-talk] It has been quiet for about ${line.quietMinutes} minutes; nobody is talking to you. It is your call: say something to the person in your bubble, do something with your tools, or just talk to yourself a little; if you have nothing to say, end this turn.`;
  },
};

/** 自定义提示词能用的占位符：{time} 时刻、{quiet} 安静分钟、{round} 轮次、{again} 是/否再次。 */
function fillPlaceholders(text: string, line: NudgeLine, language: ModelLanguage): string {
  const again = language === 'zh' ? (line.again ? '是' : '否') : (line.again ? 'yes' : 'no');
  return text
    .replaceAll('{time}', line.at)
    .replaceAll('{quiet}', String(line.quietMinutes))
    .replaceAll('{round}', String(line.round))
    .replaceAll('{again}', again);
}

/**
 * 一段叫醒正文：内置措辞 + 使用者自己的提示词。
 * 自定义提示词留空（或只剩空白）时不加，正文与原样完全一致；
 * 使用者按自己的语言写，所以不做翻译、不判断语言，原样附在下一行。
 * 只删零宽字符（BOM/零宽空格等），免得复制粘贴带进来的隐形字符混进提示词。
 */
export function composeNudge(line: NudgeLine, language: ModelLanguage, customPrompt: unknown): string {
  const base = NUDGE_TEXT[language](line);
  const custom = typeof customPrompt === 'string'
    ? customPrompt.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    : '';
  return custom ? `${base}\n${fillPlaceholders(custom, line, language)}` : base;
}
