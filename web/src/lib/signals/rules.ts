import type { Rule } from "./types";

// Fixed rule list. The LLM may only cite these ids. Patterns are case-insensitive,
// and `[^.\n]{0,N}` keeps multi-part patterns inside one sentence. Patterns run on a de-obfuscated
// copy of the text (regex.ts normalise: spaced letters, emoji separators, zero-width characters);
// quotes are always cut from the original. The Hinglish patterns are a small hand-written starter set.
//
// Narrow guards added in F5 after the eval false positives (each has a regression test):
// - guaranteed_returns: adjacentNegation ("past returns do not guarantee future returns").
// - otp_pin_request: a code right after "share OTP" means the message IS the code's issuer
//   ("Share OTP 4821 with the delivery agent"), not someone asking for it.
// - move_platform: too noisy alone ("Telegram group for the project notes", "continue planning on
//   WhatsApp"), so it now needs a second, different rule in the same text (needsCorroboration).
const NOT_HI = String.raw`(?![^.\n]{0,12}\b(?:mat|nahi|nahin|na)\b)`;

export const RULES: readonly Rule[] = [
  {
    id: "guaranteed_returns",
    label: "Guaranteed or fixed daily returns",
    adjacentNegation: true,
    patterns: [
      /\b(pakka|fixed)\s+(returns?|profits?|munafa|income)\b/gi,
      /\broz(ana)?\s+(ka\s+)?(returns?|profits?|munafa|kamai)\b/gi,
      /\bguarantee[ds]?\b[^.\n]{0,40}\b(returns?|profits?|income)\b/gi,
      /\b(daily|weekly)\s+(returns?|profits?|income|earnings?)\b/gi,
      /\b\d{1,3}(\.\d+)?\s?%\s*(daily|per day|every day|a day|weekly|per week)\b/gi,
      /\bdouble\s+your\s+(money|investment|amount)\b/gi,
      /\b(risk[- ]free|no risk)\b[^.\n]{0,30}\b(profits?|returns?|investment|trading)\b/gi,
    ],
  },
  {
    id: "withdrawal_fee",
    label: "Pay a fee or tax to unlock or withdraw funds",
    patterns: [
      /\b(withdrawal|unlock|unlocking|release|activation|clearance|processing)\s+(fee|charges?|tax)\b/gi,
      /\bpay\b[^.\n]{0,40}\b(to|before you can|in order to)\s+(withdraw|unlock|release)\b/gi,
      /\b(tax|fee)\b[^.\n]{0,30}\bbefore\b[^.\n]{0,20}\bwithdraw/gi,
      /\baccount\s+(is\s+)?(frozen|locked)\b[^.\n]{0,40}\b(pay|deposit)\b/gi,
    ],
  },
  {
    id: "urgency_deadline",
    label: "Urgency, deadline or threat of blocking",
    patterns: [
      /\bwithin\s+(\d+|one|two|an?)\s*(minutes?|mins?|hours?|hrs?)\b/gi,
      /\b(last chance|final (notice|warning|reminder)|offer (ends|expires)|expires? today|today only|before midnight)\b/gi,
      /\byour\s+(account|card|number|sim|kyc|wallet|connection)\s+(will|shall)\s+be\s+(blocked|suspended|deactivated|disconnected|frozen|closed)\b/gi,
      /\b(account|khata|sim|number|card)\b[^.\n]{0,20}\b(band|bandh|block)\s+(ho\s+jayega|kar\s+diya\s+jayega|hoga)\b/gi,
      /\b\d+\s+ghante\s+(mein|me|ke\s+andar)\b/gi,
    ],
  },
  {
    id: "seed_phrase_request",
    label: "Asks for seed phrase or private key",
    negatable: true,
    patterns: [
      /\b(seed|recovery|secret recovery|mnemonic|backup)\s+(phrase|words?)\b/gi,
      /\bprivate\s+key\b/gi,
      /\b(12|twelve|24|twenty[- ]four)[- ]words?\b/gi,
    ],
  },
  {
    id: "otp_pin_request",
    label: "Asks for OTP, UPI PIN or CVV",
    negatable: true,
    unlessFollowedBy: /^\s*(is\s*)?[:#-]?\s*\d{4,8}\b/,
    patterns: [
      /\b(share|tell|send|give|read out|forward|provide)\b[^.\n]{0,15}\b(otp|one[- ]time password|upi pin|cvv|atm pin|mpin)\b/gi,
      new RegExp(String.raw`\b(otp|upi pin|cvv|atm pin|mpin)\b(?:(?!\b(?:mat|nahi|nahin|na)\b)[^.\n]){0,15}\b(share|bata\w*|bhej\w*|de do|dijiye)\b${NOT_HI}`, "gi"),
    ],
  },
  {
    id: "move_platform",
    label: "Moves the conversation to Telegram or WhatsApp",
    needsCorroboration: true,
    patterns: [
      /\b(telegram|whatsapp)\s+(pe|par|per)\s+(aao|aaiye|baat|message|msg|join|add)\b/gi,
      /\b(move|switch|shift|continue|talk|chat|contact|message|add|join)\b[^.\n]{0,25}\b(on|to|via|in)\s+(telegram|whatsapp|signal)\b/gi,
      /\b(telegram|whatsapp)\s+(group|channel)\b/gi,
    ],
  },
  {
    id: "remote_access_app",
    label: "Asks to install a remote-access or unknown app",
    negatable: true,
    patterns: [
      /\b(anydesk|any desk|teamviewer|team viewer|quicksupport|quick support|rustdesk|airdroid|ultraviewer)\b/gi,
      /\bscreen[- ]?shar(e|ing)\b/gi,
      /\binstall\b[^.\n]{0,30}\b(apk|app|application)\b[^.\n]{0,30}\b(link|below|this)\b/gi,
    ],
  },
  {
    id: "authority_impersonation",
    label: "Claims to be police, CBI, customs or another authority",
    patterns: [
      /\b(cbi|crime branch|narcotics|ncb|enforcement directorate|interpol|trai)\b/gi,
      /\b(customs|police|cyber ?(cell|crime)|income tax|rbi)\s+(officer|department|official|inspector|headquarters)\b/gi,
      /\b(mumbai|delhi|bangalore|bengaluru|kolkata|chennai|hyderabad)\s+police\b/gi,
    ],
  },
  {
    id: "digital_arrest",
    label: "\"Digital arrest\" or arrest-warrant threat",
    patterns: [
      /\bdigital(ly)?\s+arrest/gi,
      /\b(arrest|non[- ]bailable)\s+warrant\b/gi,
      /\b(stay|remain)\s+on\s+(the\s+)?(video\s+)?call\b/gi,
      /\b(parcel|package|courier)\b[^.\n]{0,60}\b(drugs|narcotics|illegal items|seized|mdma|fake passports?)\b/gi,
      /\bmoney\s+laundering\s+(case|charges?|complaint)\b/gi,
      /\b(giraftar|giraftaar|arrest)\s+(ho\s+jaoge|ho\s+jayenge|kar\s+liya\s+jayega|kar\s+lenge)\b/gi,
    ],
  },
  {
    id: "fake_kyc",
    label: "KYC / PAN / Aadhaar update threat",
    negatable: true,
    patterns: [
      /\b(kyc|pan card|aadhaar|aadhar)\b[^.\n]{0,40}\b(expired?|block(ed)?|suspend(ed)?|deactivat(ed|e))\b/gi,
      /\b(update|complete|verify)\b[^.\n]{0,20}\bkyc\b[^.\n]{0,40}\b(click|link|call|download|immediately)\b/gi,
    ],
  },
  {
    id: "fake_refund",
    label: "Refund or cashback that needs your PIN, a QR scan or a link",
    negatable: true,
    patterns: [
      /\b(refund|cashback|reversal)\b[^.\n]{0,50}\b(click|link|scan|qr|enter (your )?(upi )?pin|approve|collect request)\b/gi,
      /\b(scan|enter (your |the )?(upi )?pin)\b[^.\n]{0,40}\b(receive|get|claim)\b/gi,
    ],
  },
  {
    id: "task_earn",
    label: "Like-and-earn or paid online tasks",
    patterns: [
      /\b(like|rate|review|subscribe|follow)\b[^.\n]{0,40}\b(earn|get paid|per (task|like|video|review)|commission)\b/gi,
      /\b(prepaid|merchant|vip)\s+tasks?\b/gi,
      /\b(part[- ]time|work from home)\b[^.\n]{0,60}\b(earn|per day|daily)\b/gi,
      /\bghar\s+(baithe|se)\b[^.\n]{0,40}\b(kamao|kamaiye|kamai|earn)\b/gi,
    ],
  },
  {
    id: "romance_investment",
    label: "Romantic contact steering towards investment",
    patterns: [/\b(my love|darling|sweetheart|honey|babe)\b[\s\S]{0,150}?\b(invest(ment)?|trading platform|crypto|usdt|forex)\b/gi],
  },
  {
    id: "third_party_account",
    label: "Pay into a third party's account",
    patterns: [
      /\b(pay|send|transfer|deposit)\b[^.\n]{0,40}\b(my|our)\s+(uncle|aunt|friend|cousin|manager|agent|colleague|assistant|secretary)('s)?\s+(account|upi|number|wallet)\b/gi,
      /\b(company|official|agent|corporate|settlement)\s+(account|wallet|upi id)\b/gi,
      /\b(this|the)\s+(account|upi id|wallet)\s+(belongs to|is of|is in the name of)\b/gi,
    ],
  },
  {
    id: "small_amount_first",
    label: "\"Send a small amount first\"",
    patterns: [
      /\b(small|minimum|token|test)\s+(amount|deposit|payment|transfer|transaction)\b/gi,
      /\b(send|pay|transfer)\s+(just\s+|only\s+)?(₹|rs\.?\s?|inr\s?)?1\s*(rupee|re)?\s+(first|to (verify|check))\b/gi,
    ],
  },
  {
    id: "fake_profit_proof",
    label: "Screenshots or claims of others' profits",
    patterns: [
      /\b(screenshots?|proof)\b[^.\n]{0,40}\b(profits?|withdrawals?|earnings?|payouts?)\b/gi,
      /\b(members?|students?|clients?|investors?)\b[^.\n]{0,30}\b(earned|made|profited)\b/gi,
    ],
  },
  {
    id: "prize_lottery",
    label: "Prize, lottery or lucky draw win",
    patterns: [/\b(you have won|you've won|lucky draw|lottery|kbc|jackpot|prize money)\b/gi],
  },
  {
    id: "utility_disconnection",
    label: "Electricity or utility disconnection threat",
    patterns: [/\b(electricity|power|gas)\b[^.\n]{0,40}\b(disconnect(ed|ion)?|cut)\b[^.\n]{0,30}\b(tonight|today|immediately)\b/gi],
  },
];

export const RULE_IDS: ReadonlySet<string> = new Set(RULES.map((r) => r.id));
export const ruleById = (id: string) => RULES.find((r) => r.id === id);
