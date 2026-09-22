import { ImageResponse } from "next/og";
import { site } from "@/config/site";
import { PUBLIC_SOCIAL_IMAGE_ALT, PUBLIC_SOCIAL_IMAGE_SIZE } from "@/config/public-site";

export const alt = PUBLIC_SOCIAL_IMAGE_ALT;
export const size = PUBLIC_SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "58px 72px",
          backgroundColor: "#101a20",
          color: "#f4f0e8",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 700, height: "100%", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: "#d2b16e", marginRight: 16 }} />
            <div style={{ fontSize: 22, letterSpacing: "0.2em", color: "#d8c99f" }}>{site.name.toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
            <div>Bad Credit</div>
            <div style={{ color: "#d2b16e" }}>to Cash</div>
          </div>
          <div style={{ display: "flex", width: 260, height: 5, marginTop: 38, backgroundColor: "#426d6b" }} />
        </div>

        <div
          style={{
            width: 292,
            height: 390,
            display: "flex",
            flexDirection: "column",
            padding: 30,
            borderRadius: 18,
            backgroundColor: "#e9e4d9",
            boxShadow: "16px 18px 0 #26383b",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#d2b16e" }} />
            <div style={{ width: 72, height: 7, borderRadius: 4, backgroundColor: "#426d6b" }} />
          </div>
          <div style={{ display: "flex", width: 190, height: 12, borderRadius: 6, backgroundColor: "#25363a", marginBottom: 18 }} />
          <div style={{ display: "flex", width: 225, height: 8, borderRadius: 4, backgroundColor: "#a9aaa0", marginBottom: 11 }} />
          <div style={{ display: "flex", width: 205, height: 8, borderRadius: 4, backgroundColor: "#a9aaa0", marginBottom: 30 }} />
          <div style={{ display: "flex", width: "100%", height: 1, backgroundColor: "#cbc8bc", marginBottom: 28 }} />
          <div style={{ display: "flex", width: 225, height: 8, borderRadius: 4, backgroundColor: "#a9aaa0", marginBottom: 12 }} />
          <div style={{ display: "flex", width: 178, height: 8, borderRadius: 4, backgroundColor: "#a9aaa0", marginBottom: 28 }} />
          <div style={{ display: "flex", width: 90, height: 34, borderRadius: 17, backgroundColor: "#426d6b" }} />
        </div>
      </div>
    ),
    PUBLIC_SOCIAL_IMAGE_SIZE,
  );
}
