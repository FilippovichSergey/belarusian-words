/**
 * Беларуская кірыліца -> класічная лацінка (ł / l, ś ź ć ń, ŭ, ch, h).
 * Таксама нармалізацыя слова для параўнання: без націскаў і ў ніжнім рэгістры.
 */

const ACUTE = /\u0301/g;

// Націск у крыніцах часта пазначаны лацінскай літарай з акутам: «Адхóн».
const LATIN_LOOKALIKE: Record<string, string> = {
  a: "а", o: "о", e: "е", i: "і", y: "у",
  A: "А", O: "О", E: "Е", I: "І", Y: "У",
};

/** Прыбірае знакі націску, вяртае чыстую кірыліцу. */
export function stripStress(input: string): string {
  const noAcute = input.normalize("NFD").replace(ACUTE, "").normalize("NFC");
  // Лацінскія двайнікі мяняем толькі ўнутры кірылічных слоў.
  return noAcute.replace(/[^\s]+/g, (token) =>
    /[\u0400-\u04FF]/.test(token)
      ? token.replace(/[aoeiyAOEIY]/g, (ch) => LATIN_LOOKALIKE[ch])
      : token,
  );
}

/** Ключ для пошуку дублікатаў: без націскаў, ніжні рэгістр, адзін прабел. */
export function wordKey(input: string): string {
  return stripStress(input)
    .toLowerCase()
    .replace(/[’ʼ`']/g, "'")
    .replace(/[.!?…]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VOWELS = new Set([..."аоуыэеёюяі"]);
const IOTATED: Record<string, string> = { е: "e", ё: "o", ю: "u", я: "a" };
const SOFTENING = new Set([..."еёюяіь"]);
const APOSTROPHES = new Set(["'", "’", "ʼ", "`"]);

const PLAIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", ж: "ž", з: "z", й: "j",
  к: "k", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ў: "ŭ", ф: "f", х: "ch", ц: "c", ч: "č", ш: "š", ы: "y", э: "e", і: "i",
  и: "i", щ: "šč", ъ: "",
};
const SOFT: Record<string, string> = { с: "ś", з: "ź", ц: "ć", н: "ń" };
// Зычныя, мяккасць якіх перадаецца на папярэднія с, з, ц.
const SOFT_CAPABLE = new Set([..."бвзлмнпсфц"]);

function translitWord(word: string): string {
  const src = [...word.toLowerCase()];
  const n = src.length;

  // isSoft[i]: зычная на пазіцыі i мяккая (з улікам асіміляцыі).
  const isSoft = new Array<boolean>(n).fill(false);
  for (let i = n - 1; i >= 0; i--) {
    const ch = src[i];
    const next = src[i + 1];
    if (VOWELS.has(ch) || ch === "ь" || APOSTROPHES.has(ch)) continue;
    if (next !== undefined && SOFTENING.has(next)) {
      isSoft[i] = true;
      continue;
    }
    const sibilant = ch === "с" || ch === "з" || ch === "ц";
    // «з’ява», «раз’юшаны»: мяккасць перад апострафам і ётаванай галоснай.
    if (sibilant && next !== undefined && APOSTROPHES.has(next) && src[i + 2] in IOTATED) {
      isSoft[i] = true;
      continue;
    }
    // «здзяцінець»: мяккае «дз» змякчае папярэднюю зычную.
    if (sibilant && next === "д" && src[i + 2] === "з" && isSoft[i + 2]) {
      isSoft[i] = true;
      continue;
    }
    if (next === undefined || !isSoft[i + 1]) continue;
    if (ch === "л" && next === "л") isSoft[i] = true;
    else if (ch === "н" && next === "н") isSoft[i] = true;
    else if (sibilant && SOFT_CAPABLE.has(next)) {
      isSoft[i] = true;
    }
  }

  let out = "";
  for (let i = 0; i < n; i++) {
    const ch = src[i];
    const prev = src[i - 1];

    if (ch === "ь" || APOSTROPHES.has(ch)) continue;

    if (ch === "л") {
      out += isSoft[i] ? "l" : "ł";
      continue;
    }

    if (ch in IOTATED) {
      const afterConsonant =
        prev !== undefined && !VOWELS.has(prev) && prev !== "ь" &&
        prev !== "ў" && prev !== "й" && !APOSTROPHES.has(prev) && /\p{L}/u.test(prev);
      if (!afterConsonant) out += "j" + IOTATED[ch];
      else if (prev === "л") out += IOTATED[ch];
      else out += "i" + IOTATED[ch];
      continue;
    }

    if (ch === "і") {
      out += prev !== undefined && (prev === "ь" || APOSTROPHES.has(prev)) ? "ji" : "i";
      continue;
    }

    if (ch in SOFT && isSoft[i]) {
      // Перад галоснай мяккасць ужо перадае «i» (sia, cie), таму знак не патрэбны.
      const next = src[i + 1];
      const beforeSoftVowel = next !== undefined && next !== "ь" && SOFTENING.has(next);
      out += beforeSoftVowel ? PLAIN[ch] : SOFT[ch];
      continue;
    }

    out += PLAIN[ch] ?? ch;
  }

  // Аднаўляем вялікую літару: першая вялікая ці ўсё слова вялікімі.
  const letters = [...word].filter((c) => /\p{L}/u.test(c));
  const allUpper = letters.length > 1 && letters.every((c) => c === c.toUpperCase());
  if (allUpper) return out.toUpperCase();
  const first = [...word][0];
  if (first && first !== first.toLowerCase()) {
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

/** Транслітаруе слова ці выраз, захоўваючы прабелы і пунктуацыю. */
export function toLacinka(input: string): string {
  return stripStress(input).replace(/[\u0400-\u04FF'’ʼ`]+/g, (w) =>
    /[\u0400-\u04FF]/.test(w) ? translitWord(w) : w,
  );
}
