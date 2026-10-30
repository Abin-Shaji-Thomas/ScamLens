// Plain-language guide for the public pattern library (/patterns), keyed by the rule ids in rules.ts.
// The page takes the rule list, labels and guards from rules.ts (the same source the engine uses); this file adds
// only the explanation. A test requires one entry per rule, and that each example triggers its own rule.
// Examples are invented ("Illustrative example") and use reserved demo identifiers.

export interface PatternGuide {
  name: string;
  looksLike: string;
  why: string;
  whatToDo: string;
  example: string;
  /** Rule-specific cases that are not a signal (general guards and warning context are added by the page). */
  notASignal?: string;
}

export const PATTERN_GUIDE: Record<string, PatternGuide> = {
  guaranteed_returns: {
    name: "Guaranteed or fixed returns",
    looksLike: "A promise of fixed daily or weekly profit, \"double your money\", or \"no risk\" investing.",
    why: "Real investments cannot promise a fixed profit; the promise creates trust before money is asked for.",
    whatToDo: "Do not invest. Check whether the firm is registered with SEBI or RBI through their own websites.",
    example: "Join now and get guaranteed returns of 3% daily on your deposit.",
    notASignal: "Statements that returns are not guaranteed (\"past returns do not guarantee future returns\").",
  },
  withdrawal_fee: {
    name: "Pay to withdraw",
    looksLike: "A fee, tax or \"activation charge\" you must pay before you can take out money shown in an account.",
    why: "The balance on screen is usually not real; each fee is another payment.",
    whatToDo: "Do not pay. A genuine platform deducts charges from the balance, it does not ask for new money.",
    example: "Your profit is ready, but you must pay the withdrawal fee of Rs 4,999 first.",
  },
  urgency_deadline: {
    name: "Urgency or a threat of blocking",
    looksLike: "\"Within 2 hours\", \"last chance\", \"your account will be blocked today\".",
    why: "Pressure leaves no time to check with someone else.",
    whatToDo: "Pause. Contact the bank or company through the number on its official website or your card.",
    example: "Update now or your account will be blocked within 2 hours.",
  },
  seed_phrase_request: {
    name: "Asks for a seed phrase or private key",
    looksLike: "A request for the 12 or 24 recovery words of a crypto wallet, or its private key.",
    why: "Whoever has these words controls the wallet and can empty it.",
    whatToDo: "Never share them with anyone, including \"support\" staff. No genuine service asks for them.",
    example: "To verify your wallet, send us your 12-word recovery phrase.",
  },
  otp_pin_request: {
    name: "Asks for an OTP, UPI PIN or CVV",
    looksLike: "A request to share or read out a one-time password, UPI PIN, ATM PIN or card CVV.",
    why: "These codes approve payments; sharing one lets the other person take money.",
    whatToDo: "Never share them. A UPI PIN is only needed to send money, never to receive it.",
    example: "Please share the OTP you just received to complete the refund.",
    notASignal: "A message that itself contains your code (\"Share OTP 4821 with the delivery agent\"): that is the issuer's notice.",
  },
  move_platform: {
    name: "Moves the chat to Telegram or WhatsApp",
    looksLike: "\"Let's continue on Telegram\", \"join our WhatsApp group\".",
    why: "Private apps make the conversation harder to trace and easier to control.",
    whatToDo: "Be careful if a stranger insists on switching apps, especially together with other signs.",
    example: "Our VIP team will guide you, join our Telegram group for guaranteed returns.",
    notASignal: "On its own: it counts only when another rule also fires in the same text.",
  },
  remote_access_app: {
    name: "Asks you to install a remote-access app",
    looksLike: "AnyDesk, TeamViewer, QuickSupport, screen sharing, or an APK from a link.",
    why: "These apps let the other person see and control your phone, including banking apps.",
    whatToDo: "Do not install. Uninstall it if you already did, and tell your bank.",
    example: "Please install AnyDesk so our executive can fix your account.",
  },
  authority_impersonation: {
    name: "Claims to be police, CBI, customs or another authority",
    looksLike: "\"Mumbai Police\", \"CBI officer\", \"customs department\", \"TRAI\".",
    why: "Authority makes threats believable and stops people from asking questions.",
    whatToDo: "Hang up. Officials do not demand payments over video calls or chats; call 1930 to check.",
    example: "This is the CBI officer handling your case, stay on the line.",
  },
  digital_arrest: {
    name: "\"Digital arrest\" or arrest-warrant threat",
    looksLike: "\"You are under digital arrest\", \"stay on the video call\", a parcel with drugs in your name.",
    why: "Fear and isolation: the person is kept on a call until they transfer money.",
    whatToDo: "There is no such thing as a digital arrest in Indian law. End the call and call 1930.",
    example: "You are under digital arrest, stay on the video call until the inquiry is complete.",
    notASignal: "Advice that names the threat (\"there is no such thing as a digital arrest\").",
  },
  fake_kyc: {
    name: "KYC, PAN or Aadhaar update threat",
    looksLike: "\"Your KYC has expired\", \"PAN will be blocked\", with a link or number to call.",
    why: "It looks routine, and the link leads to a page that collects card or login details.",
    whatToDo: "Update KYC only in the bank's own app or branch; never through a link in a message.",
    example: "Your KYC has expired and your account will be suspended, click the link to update.",
  },
  fake_refund: {
    name: "Refund that needs your PIN, a QR scan or a link",
    looksLike: "A refund or cashback you must \"collect\" by scanning a QR code or entering your UPI PIN.",
    why: "Scanning or entering a PIN sends money out of your account, not in.",
    whatToDo: "Never enter a PIN to receive money. Refunds arrive on their own.",
    example: "Your refund of Rs 2,499 is ready, scan the QR code to receive it.",
  },
  task_earn: {
    name: "Like-and-earn or paid online tasks",
    looksLike: "Money for liking videos, rating hotels or \"prepaid tasks\", often starting with small real payouts.",
    why: "Small early payouts build trust before a larger \"task\" needs your money.",
    whatToDo: "Stop before paying anything. Real jobs do not ask you to deposit money.",
    example: "Like these videos and earn Rs 150 per task, work from home and earn daily.",
  },
  romance_investment: {
    name: "Romance that turns into an investment pitch",
    looksLike: "A new online friend or partner who soon suggests a trading platform or crypto.",
    why: "Emotional trust is used to steer someone into a fake platform.",
    whatToDo: "Do not invest through someone you only know online. Talk to family or a friend first.",
    example: "My love, I made so much on this crypto trading platform, you should invest too.",
  },
  third_party_account: {
    name: "Pay into someone else's account",
    looksLike: "\"Pay to my uncle's account\", \"use the company settlement UPI ID\".",
    why: "Money sent to a third party is harder to trace back to the person asking.",
    whatToDo: "Pay only the business itself, through its official, verified payment page.",
    example: "Transfer the amount to my manager's account, it is our company account.",
  },
  small_amount_first: {
    name: "\"Send a small amount first\"",
    looksLike: "A token, test or minimum payment to \"verify\" something.",
    why: "A small first payment tests whether you will pay, and makes the next request easier.",
    whatToDo: "Do not send anything to verify an account or a prize.",
    example: "Just send a small amount first so we can verify your UPI ID.",
  },
  fake_profit_proof: {
    name: "Screenshots or claims of others' profits",
    looksLike: "Screenshots of withdrawals, \"our members earned 3 lakh\".",
    why: "Screenshots are easy to fake and create pressure to join.",
    whatToDo: "Ignore screenshots; they prove nothing. Check registrations yourself.",
    example: "See the screenshots of profits, our members earned 2 lakh last month.",
  },
  prize_lottery: {
    name: "Prize, lottery or lucky draw win",
    looksLike: "\"You have won\", KBC lottery, a lucky draw that needs a fee to claim.",
    why: "A win you never entered is followed by a \"processing fee\".",
    whatToDo: "You cannot win a draw you did not enter. Do not pay any fee.",
    example: "Congratulations, you have won the KBC lottery of Rs 25 lakh.",
    notASignal: "\"Lucky draw\" alone (for example a housing society's festival draw) unless it addresses you, a claim or a payment.",
  },
  utility_disconnection: {
    name: "Electricity or gas disconnection threat",
    looksLike: "\"Your electricity will be disconnected tonight\" with a number to call.",
    why: "Fear of a sudden outage pushes people to pay a fake bill or install an app.",
    whatToDo: "Check your bill in the official board's app or website, or visit the office.",
    example: "Your electricity connection will be disconnected tonight, call this officer now.",
  },
};
