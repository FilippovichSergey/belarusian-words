/**
 * Каналы, з якіх штодня забіраюцца словы і выразы.
 * Каб дадаць канал, дапішыце радок сюды. Канал мусіць быць публічным.
 */
export type ChannelConfig = {
  /** Назва канала з адраса t.me/<username>. */
  username: string;
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
  { username: "verbarium_by", tag: "verbarium", autoPublishExact: true, readImages: false },
  { username: "lohkaja_mova", tag: "lohkaja-mova", autoPublishExact: false, readImages: true },
  { username: "modaNaMovu", tag: "moda-na-movu", autoPublishExact: false, readImages: true },
];
