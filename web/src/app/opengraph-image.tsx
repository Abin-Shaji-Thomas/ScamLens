import { ImageResponse } from "next/og";

// Share preview (1200x630), generated at build time. Palette tokens only: white, black, secondary text, rule.
export const alt = "ScamLens: evidence-linked scam check for India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", borderTop: "8px solid #000000", width: "100%" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 150, fontWeight: 400, color: "#000000", letterSpacing: "-0.02em", lineHeight: 1 }}>ScamLens</div>
          <div style={{ fontSize: 50, color: "#4b5563", marginTop: 32 }}>Evidence-linked scam check for India</div>
        </div>
        <div style={{ display: "flex", borderTop: "2px solid #e5e7eb", paddingTop: 24, fontSize: 28, color: "#4b5563" }}>
          Verified · Reported · Suspected, each with its source. Evidence, not verdicts.
        </div>
      </div>
    ),
    { ...size },
  );
}
