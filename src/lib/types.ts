export type Word = {
  id: string;
  be: string;
  be_lat: string | null;
  en: string | null;
  ru: string | null;
  comment: string | null;
  image_path: string | null;
  tags: string[];
  /** Чарнавікі бачыць толькі аўтарызаваны карыстальнік. */
  status: "draft" | "published";
  /** Адкуль слова, напрыклад назва Telegram-канала. */
  source: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};
