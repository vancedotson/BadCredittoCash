"use client";

import { useEffect, useRef, useState } from "react";

type StudioState = "idle" | "preparing" | "live";

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
  const whipSessionRef = useRef<string | null>(null);
  const [state, setState] = useState<StudioState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    const whipSession = whipSessionRef.current;
    whipSessionRef.current = null;
    if (whipSession) void fetch(whipSession, { method: "DELETE" }).catch(() => undefined);
    peerRef.current?.close();
    peerRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }

  useEffect(() => () => { peerRef.current?.close(); mediaRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function start() {
    setError(null); setState("preparing");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaRef.current = media;
      if (videoRef.current) videoRef.current.srcObject = media;
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
      onPrepared();
    } catch (cause) {
      await stop();
      setError(cause instanceof Error ? cause.message : "The broadcast could not be started.");
    }
  }

  async function shareScreen() {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === "video");
      if (!track || !sender) throw new Error("The screen could not be shared.");
      await sender.replaceTrack(track);
      track.addEventListener("ended", () => {
        const camera = mediaRef.current?.getVideoTracks()[0];
        if (camera) void sender.replaceTrack(camera);
      }, { once: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The screen could not be shared.");
    }
  }

  if (!configured) return <p className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed text-slate">Browser broadcasting is built in. Cloudflare Stream billing and its API token still need to be connected.</p>;

  return <div className="space-y-3 rounded-lg border border-mist bg-cloud/40 p-3">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-heading">Broadcast studio</p><span className={`text-xs font-medium ${state === "live" ? "text-green" : "text-slate"}`}>{state === "live" ? "Live" : state === "preparing" ? "Starting…" : "Offline"}</span></div>
    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-md bg-ink object-cover" />
    {error ? <p role="alert" className="text-xs text-red">{error}</p> : null}
    <div className="flex gap-2">
      {state === "idle" ? <button type="button" onClick={() => void start()} disabled={disabled} className="flex-1 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">Start live</button> : <button type="button" onClick={() => void stop()} className="flex-1 rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white">End live</button>}
      {state === "live" ? <button type="button" onClick={() => void shareScreen()} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body">Share screen</button> : null}
    </div>
  </div>;
}
