/**
 * Telegram-каналы, з якіх штодня забіраюцца словы і выразы.
 * Адзін спіс для сайта (спасылкі ўнізе старонкі) і для scripts/sync-telegram.ts.
 * Каб дадаць канал, дапішыце радок сюды. Канал мусіць быць публічным.
 */
export type ChannelConfig = {
  /** Назва канала з адраса t.me/<username>. */
  username: string;
  /** Назва канала, як яна паказваецца ў Telegram. */
  title: string;
  /** Кароткае апісанне для сайта. */
  description: string;
  /** Тэг, які атрымліваюць усе словы з гэтага канала. */
  tag: string;
  /**
   * true: словы ў дакладным фармаце «Кірыліца / Lacinka / English / Русский»
   * публікуюцца адразу. Усё астатняе заўсёды трапляе ў чарнавікі.
   */
  autoPublishExact: boolean;
  /**
   * true: калі змест паста знаходзіцца на малюнку, малюнак даецца Gemini,
   * каб прачытаць тэкст. Самі малюнкі нідзе не захоўваюцца.
   */
  readImages: boolean;
};

export const CHANNELS: ChannelConfig[] = [
  {
    username: "verbarium_by",
    title: "Verbarium",
    description: "Кветнік словаў",
    tag: "verbarium",
    autoPublishExact: true,
    readImages: false,
  },
  {
    username: "lohkaja_mova",
    title: "Лёгкая Мова",
    description: "Словы, выразы і як сказаць па-беларуску",
    tag: "lohkaja-mova",
    autoPublishExact: false,
    readImages: true,
  },
  {
    username: "modaNaMovu",
    title: "Мода На Мову",
    description: "Выраз дня, фразеалагізмы і моўныя парады",
    tag: "moda-na-movu",
    autoPublishExact: false,
    readImages: true,
  },
];

export function channelUrl(username: string): string {
  return `https://t.me/${username}`;
}

/** Назва канала па яго username; калі канала няма ў спісе, вяртае сам username. */
export function channelTitle(username: string | null | undefined): string | null {
  if (!username) return null;
  return CHANNELS.find((c) => c.username === username)?.title ?? username;
}
