export type Word = {
  id: string;
  be: string;
  be_lat: string | null;
  en: string | null;
  ru: string | null;
  comment: string | null;
  image_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};
