// Demo inputs used in the UI and in the README's 90-second demo script.
// All are synthetic. Sample 2 uses a wallet address that is genuinely on the OFAC SDN list
// so the Verified tier can be shown live; the surrounding chat is invented.
export const SAMPLE_WATERMARK = "Illustrative - not a real investigation";

export const SAMPLES = [
  {
    id: "digital-arrest",
    title: "1. \"Digital arrest\" call",
    text:
      "This is Inspector Rao from Mumbai Police cyber cell. A courier package in your name with MDMA was seized. " +
      "You are under digital arrest. Stay on the video call and do not tell your family. " +
      "Transfer your savings to our RBI verification account within 2 hours: zzdemo.verify@okdemo",
  },
  {
    id: "crypto-investment",
    title: "2. Crypto \"investment\" with a sanctioned wallet",
    text:
      "Hi dear, our VIP group gives guaranteed returns of 4% daily on USDT. See the screenshots of profit from members. " +
      "Send a small amount first to 0x252a8bd2319d8a555b872990601221b3a2053bce and then join our Telegram channel @zz_demo_vipsignals.",
  },
  {
    id: "bank-alert",
    title: "3. Genuine-looking bank alert",
    text:
      "HDFC Bank: Rs 3,450 debited from A/c XX4521 on 27-10-26. Not you? Call the number on the back of your card. " +
      "Never share your OTP, PIN or CVV with anyone.",
  },
] as const;
