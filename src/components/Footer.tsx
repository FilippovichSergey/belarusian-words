import { CHANNELS, channelUrl } from "@/lib/telegram-channels";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm">
        <p className="text-stone-600 dark:text-stone-400">
          Словы і выразы штодня збіраюцца з беларускамоўных Telegram-каналаў. Дзякуй іх
          аўтарам. Падпісвайцеся:
        </p>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {CHANNELS.map((channel) => (
            <li key={channel.username}>
              <a
                href={channelUrl(channel.username)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                {channel.title}
              </a>
              <span className="text-stone-500"> · {channel.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
