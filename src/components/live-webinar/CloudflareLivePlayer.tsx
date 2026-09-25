"use client";

import { useEffect, useRef, useState } from "react";

type PlayerState = "connecting" | "live" | "offline" | "unsupported";
type ReportedPlayerState = Exclude<PlayerState, "unsupported">;

export function CloudflareLivePlayer({ endpoint, onState }: { endpoint: string; onState: (state: ReportedPlayerState) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endpointRef = useRef(endpoint);
  const onStateRef = useRef(onState);
  const [state, setState] = useState<PlayerState>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { endpointRef.current = endpoint; }, [endpoint]);
  useEffect(() => { onStateRef.current = onState; }, [onState]);

  useEffect(() => {
    let active = true;
    let connected = false;
    let playbackSessionUrl: string | null = null;
    const video = videoRef.current;
    const updateState = (next: PlayerState) => {
      if (!active) return;
      setState(next);
      onStateRef.current(next === "unsupported" ? "offline" : next);
    };
    updateState("connecting");
    if (typeof window.RTCPeerConnection !== "function" || typeof window.MediaStream !== "function") {
      updateState("unsupported");
      return () => { active = false; };
    }
    const peer = new window.RTCPeerConnection();
    const stream = new window.MediaStream();
    if (video) video.srcObject = stream;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!stream.getTracks().some((current) => current.id === track.id)) stream.addTrack(track);
      }
      connected = true;
      if (timeout) clearTimeout(timeout);
      updateState("live");
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected" || peer.connectionState === "closed") {
        updateState("offline");
      }
    };
    const timeout = setTimeout(() => {
      if (!connected) {
        updateState("offline");
        peer.close();
      }
    }, 20_000);

    void (async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const playbackEndpoint = endpointRef.current;
        const response = await fetch(playbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
          referrerPolicy: "no-referrer",
        });
        if (!response.ok) throw new Error("Playback is not available.");
        const answer = await response.text();
        if (!answer || !active) throw new Error("Playback did not start.");
        await peer.setRemoteDescription({ type: "answer", sdp: answer });
        const location = response.headers.get("Location");
        if (location) {
          const candidate = new URL(location, playbackEndpoint);
          if (candidate.protocol === "https:" && candidate.origin === new URL(playbackEndpoint).origin) playbackSessionUrl = candidate.toString();
        }
      } catch {
        updateState("offline");
      }
    })();

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
      if (video) video.srcObject = null;
      if (playbackSessionUrl) {
        void fetch(playbackSessionUrl, { method: "DELETE", keepalive: true, referrerPolicy: "no-referrer" }).catch(() => undefined);
      }
    };
  }, [attempt]);

  return <div className="space-y-3">
    <video ref={videoRef} autoPlay playsInline controls aria-label="Live webinar video" className="aspect-video w-full rounded bg-black" />
    {state === "connecting" ? <p role="status" className="text-sm text-slate">Connecting to the live stream…</p> : null}
    {state === "offline" || state === "unsupported" ? <div className="flex flex-wrap items-center justify-between gap-3" role="status">
      {state === "unsupported"
        ? <p className="text-sm text-slate">This browser can’t play the live stream. Update your browser or device, then try again. Live sessions are not recorded.</p>
        : <p className="text-sm text-slate">The host’s live stream is not connected right now. This session is not recorded.</p>}
      <button type="button" className="rounded-lg border border-mist px-3 py-2 text-sm font-medium text-body" onClick={() => { setState("connecting"); onStateRef.current("connecting"); setAttempt((value) => value + 1); }}>Try again</button>
    </div> : null}
  </div>;
}
