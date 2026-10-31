// "Common scams in India" on the home page and /about#scam-types. Each example is invented, uses demo identifiers only,
// and follows a scam type that a public page describes (opened 2026-10-30, paraphrased; docs/DATASET.md). No ranking or
// statistics are claimed.

export const SCAM_TYPE_LABEL = "Illustrative example based on commonly reported scam types";

export interface ScamSource {
  publisher: string;
  title: string;
  date: string;
  url: string;
}

export interface ScamType {
  id: string;
  name: string;
  summary: string;
  example: string;
  source: ScamSource;
}

export const SCAM_TYPES: readonly ScamType[] = [
  {
    id: "digital-arrest",
    name: "Digital arrest",
    summary: "A caller poses as police or a central agency, says a parcel with drugs was seized, keeps you on a video call and asks for a \"verification\" transfer.",
    example:
      "This is an officer from the cyber crime branch. A parcel in your name was seized with drugs and you are under digital arrest. Stay on the video call and do not tell anyone. Transfer your savings to the RBI verification account within 2 hours: zzdemo.cbi.verify@okdemo",
    source: { publisher: "The Tribune (PTI), report of an I4C advisory", title: "Advisory to curb 'digital arrest'", date: "2024-10-07", url: "https://www.tribuneindia.com/news/india/cbi-ed-dont-nab-via-video-calls-advisory-to-curb-digital-arrest/" },
  },
  {
    id: "telegram-task",
    name: "Telegram task job",
    summary: "Paid \"like\" or rating tasks that pay a little at first, then ask for a joining fee or bigger deposits.",
    example:
      "Part time job: earn 3,000 a day just by liking videos. Complete simple tasks, then join our VIP task group. Message @zzdemo_hr_admin on Telegram and first pay a 999 joining fee to zzdemo.taskpay@okdemo.",
    source: { publisher: "CareerIndia", title: "Fake job offers on Telegram and WhatsApp", date: "2026-09-17", url: "https://www.careerindia.com/features/telegram-and-whatsapp-task-scams-how-to-identify-fake-work-from-home-job-offers-and-protect-your-money-2026-011-65711.html" },
  },
  {
    id: "fake-kyc",
    name: "Fake KYC / bank block",
    summary: "An SMS says your account will be blocked unless you update KYC through a link and share an OTP.",
    example:
      "Dear customer, your KYC has expired and your bank account will be blocked today. Update your KYC now at https://kyc-verify.example.net and share the OTP to complete verification.",
    source: { publisher: "Reserve Bank of India", title: "RBI cautions against frauds in the name of KYC updation", date: "2021-09-13", url: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=52216" },
  },
  {
    id: "crypto-group",
    name: "Crypto investment group",
    summary: "A contact builds trust, then moves you to a \"mentor\" group and a trading site that shows profits but blocks withdrawals.",
    example:
      "Our mentor @zzdemo_fx_mentor guarantees 20% weekly returns; members earned 5 lakh last month. Start with a small amount, pay zzdemo.lovely.trades@okdemo and trade on zz-coinvault.example.com, then you can withdraw.",
    source: { publisher: "The News Minute", title: "Chennai man loses Rs 10 lakh in 'pig butchering' fake crypto scam", date: "2022-05-05", url: "https://www.thenewsminute.com/article/chennai-man-loses-rs-10-lakh-pig-butchering-fake-crypto-scam-163617" },
  },
  {
    id: "p2p-freeze",
    name: "P2P \"bank freeze\"",
    summary: "After a peer-to-peer crypto sale, the \"buyer\" says their account was frozen because of a fraud complaint and demands the money back.",
    example:
      "I bought USDT from you on P2P and now my bank account is frozen because the money came from a fraud complaint. Send the money back to zzdemo.p2p.refund@okdemo within 1 hour or I will file a police case against you.",
    source: { publisher: "Siasat, report of a Hyderabad police advisory", title: "Police advisory warns against P2P crypto trading frauds", date: "2024-05-03", url: "https://www.siasat.com/hyderabad-police-advisory-warns-against-p2p-crypto-trading-frauds-3019426/" },
  },
];
