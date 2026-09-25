"use client";

import { useEffect, useRef, useState } from "react";

type StudioState = "idle" | "preparing" | "live";
type ConnectionQuality = "idle" | "checking" | "good" | "poor";

function waitForIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const listener = () => {
      if (peer.iceGatheringState === "complete") {
        peer.removeEventListener("icegatheringstatechange", listener);
        resolve();
      }
    };
    peer.addEventListener("icegatheringstatechange", listener);
  });
}

export function CloudflareBroadcastStudio({ sessionId, configured, disabled, onPrepared }: { sessionId: string; configured: boolean; disabled: boolean; onPrepared: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const displayRef = useRef<MediaStream | null>(null);
  const compositionTrackRef = useRef<MediaStreamTrack | null>(null);
  const animationRef = useRef<number | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outboundBytesRef = useRef(0);
  const whipSessionRef = useRef<string | null>(null);
  const [state, setState] = useState<StudioState>("idle");
  const [sharing, setSharing] = useState(false);
  const [devicesReady, setDevicesReady] = useState(false);
  const [quality, setQuality] = useState<ConnectionQuality>("idle");
  const [error, setError] = useState<string | null>(null);

  async function prepareDevices(): Promise<MediaStream> {
    const current = mediaRef.current;
    if (current?.getTracks().every((track) => track.readyState === "live")) return current;
    const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    mediaRef.current = media;
    if (videoRef.current) videoRef.current.srcObject = media;
    for (const track of media.getTracks()) track.addEventListener("ended", () => setDevicesReady(false), { once: true });
    setDevicesReady(true);
    return media;
  }

  async function testDevices() {
    setError(null);
    try { await prepareDevices(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Camera and microphone access could not be confirmed."); }
  }

  function monitorConnection(peer: RTCPeerConnection) {
    setQuality("checking");
    qualityTimerRef.current = setInterval(() => {
      void peer.getStats().then((reports) => {
        let outboundBytes = 0;
        reports.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video" && !report.isRemote && typeof report.bytesSent === "number") outboundBytes += report.bytesSent;
        });
        setQuality(peer.connectionState === "connected" && outboundBytes > outboundBytesRef.current ? "good" : "poor");
        outboundBytesRef.current = outboundBytes;
      }).catch(() => setQuality("poor"));
    }, 3000);
  }

  async function stopScreenShare(restoreCamera = true) {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    displayRef.current?.getTracks().forEach((track) => track.stop());
    displayRef.current = null;
    compositionTrackRef.current?.stop();
    compositionTrackRef.current = null;
    const camera = mediaRef.current?.getVideoTracks()[0];
    if (restoreCamera && camera) {
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === "video");
      if (sender) await sender.replaceTrack(camera);
      if (videoRef.current) videoRef.current.srcObject = mediaRef.current;
    }
    setSharing(false);
  }

  async function stop() {
    const whipSession = whipSessionRef.current;
    whipSessionRef.current = null;
    if (whipSession) void fetch(whipSession, { method: "DELETE" }).catch(() => undefined);
    await stopScreenShare(false);
    peerRef.current?.close();
    peerRef.current = null;
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = null;
    outboundBytesRef.current = 0;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setDevicesReady(false);
    setQuality("idle");
    setState("idle");
  }

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    peerRef.current?.close();
    displayRef.current?.getTracks().forEach((track) => track.stop());
    compositionTrackRef.current?.stop();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (state !== "live") return;
    const protectBroadcast = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectBroadcast);
    return () => window.removeEventListener("beforeunload", protectBroadcast);
  }, [state]);

  async function start() {
    setError(null); setState("preparing");
    try {
      const media = await prepareDevices();
      const setup = await fetch(`/api/crm/live-webinars/${encodeURIComponent(sessionId)}/stream`, { method: "POST" });
      const result = await setup.json() as { publishUrl?: string; error?: string };
      if (!setup.ok || !result.publishUrl) throw new Error(result.error || "The broadcast could not be prepared.");

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      for (const track of media.getTracks()) peer.addTransceiver(track, { direction: "sendonly" });
      await peer.setLocalDescription(await peer.createOffer());
      await waitForIce(peer);
      const publish = await fetch(result.publishUrl, { method: "POST", headers: { "content-type": "application/sdp" }, body: peer.localDescription?.sdp });
      if (!publish.ok) throw new Error("Cloudflare could not start the broadcast.");
      await peer.setRemoteDescription({ type: "answer", sdp: await publish.text() });
      const location = publish.headers.get("location");
      if (location) whipSessionRef.current = new URL(location, result.publishUrl).toString();
      setState("live");
      monitorConnection(peer);
      onPrepared();
    } catch (cause) {
      await stop();
      setError(cause instanceof Error ? cause.message : "The broadcast could not be started.");
    }
  }

  async function confirmStop() {
    if (window.confirm("End this live broadcast for everyone?")) await stop();
  }

  async function shareScreen() {
    try {
      if (sharing) { await stopScreenShare(); return; }
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      displayRef.current = display;
      const screenVideo = document.createElement("video");
      const cameraVideo = document.createElement("video");
      for (const video of [screenVideo, cameraVideo]) { video.muted = true; video.playsInline = true; }
      screenVideo.srcObject = display;
      cameraVideo.srcObject = mediaRef.current;
      await Promise.all([screenVideo.play(), cameraVideo.play()]);

      const screenTrack = display.getVideoTracks()[0];
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === "video");
      if (!screenTrack || !sender) throw new Error("The screen could not be shared.");

      const settings = screenTrack.getSettings();
      const sourceWidth = settings.width || screenVideo.videoWidth || 1280;
      const sourceHeight = settings.height || screenVideo.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(sourceWidth, 1920);
      canvas.height = Math.round(canvas.width * sourceHeight / sourceWidth);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The camera overlay could not be created.");

      const draw = () => {
        context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        if (cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const overlayWidth = Math.min(canvas.width * 0.24, 360);
          const cameraRatio = cameraVideo.videoWidth && cameraVideo.videoHeight ? cameraVideo.videoWidth / cameraVideo.videoHeight : 16 / 9;
          const overlayHeight = overlayWidth / cameraRatio;
          const margin = Math.max(16, canvas.width * 0.018);
          const x = canvas.width - overlayWidth - margin;
          const y = canvas.height - overlayHeight - margin;
          context.fillStyle = "#ffffff";
          context.fillRect(x - 4, y - 4, overlayWidth + 8, overlayHeight + 8);
          context.drawImage(cameraVideo, x, y, overlayWidth, overlayHeight);
        }
        animationRef.current = requestAnimationFrame(draw);
      };
      draw();
      const composedTrack = canvas.captureStream(30).getVideoTracks()[0];
      if (!composedTrack) throw new Error("The camera overlay could not be captured.");
      compositionTrackRef.current = composedTrack;
      await sender.replaceTrack(composedTrack);
      if (videoRef.current) videoRef.current.srcObject = new MediaStream([composedTrack]);
      setSharing(true);
      screenTrack.addEventListener("ended", () => { void stopScreenShare(); }, { once: true });
    } catch (cause) {
      await stopScreenShare();
      setError(cause instanceof Error ? cause.message : "The screen could not be shared.");
    }
  }

  if (!configured) return <p className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed text-slate">Broadcast setup is unavailable. Cloudflare Stream must be enabled and its API token and playback signing key configured before an administrator can prepare a live input.</p>;

  return <div className="space-y-3 rounded-lg border border-mist bg-cloud/40 p-3">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-heading">Broadcast studio</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state === "live" ? "bg-red text-white" : "bg-mist text-slate"}`}>{state === "live" ? "● YOU ARE LIVE" : state === "preparing" ? "Starting…" : "Offline"}</span></div>
    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-md bg-ink object-cover" />
    <div className="flex flex-wrap gap-2 text-xs">
      <span className={devicesReady ? "text-green" : "text-slate"}>{devicesReady ? "✓ Camera ready" : "Camera not tested"}</span>
      <span className={devicesReady ? "text-green" : "text-slate"}>{devicesReady ? "✓ Microphone ready" : "Microphone not tested"}</span>
      {state === "live" ? <span className={quality === "good" ? "text-green" : quality === "poor" ? "text-red" : "text-slate"}>Connection: {quality === "good" ? "good" : quality === "poor" ? "unstable" : "checking…"}</span> : null}
    </div>
    {error ? <p role="alert" className="text-xs text-red">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      {state === "idle" ? <><button type="button" onClick={() => void testDevices()} disabled={disabled} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body disabled:opacity-50">Test camera &amp; mic</button><button type="button" onClick={() => void start()} disabled={disabled || !devicesReady} className="flex-1 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">Start live</button></> : <button type="button" onClick={() => void confirmStop()} className="flex-1 rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white">End live</button>}
      {state === "live" ? <button type="button" onClick={() => void shareScreen()} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body">{sharing ? "Stop sharing" : "Share screen + camera"}</button> : null}
    </div>
    {state === "idle" && !devicesReady ? <p className="text-xs leading-relaxed text-slate">Test both devices before the Start live button becomes available.</p> : null}
  </div>;
}
