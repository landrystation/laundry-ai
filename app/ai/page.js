"use client";

import { useRef, useState } from "react";

export default function AIPage() {
  const [status, setStatus] = useState("待機中");
  const [started, setStarted] = useState(false);

  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  async function startAI() {
    if (started) return;

    try {
      setStarted(true);
      setStatus("マイク許可待ち");

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      setStatus("カメラ許可待ち");

      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" }
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStream;
      }

      setStatus("AI接続中");

      const stream = new MediaStream([
        ...micStream.getAudioTracks()
      ]);

      const pc = new RTCPeerConnection();

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      const dc = pc.createDataChannel("oai-events");

      dc.onopen = () => {
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            turn_detection: {
              type: "server_vad",
              threshold: 0.9,
              prefix_padding_ms: 300,
              silence_duration_ms: 1500,
              create_response: true,
              interrupt_response: true
            }
          }
        }));

        dc.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "こんにちは😊 なにかお困りですか？ そのまま話してください♪ この挨拶は1回だけ行い、その後は無音時・雑音・物音・周囲の音には反応せず、お客様の明確な発話があるまで待機してください。"
              }
            ]
          }
        }));

        dc.send(JSON.stringify({
          type: "response.create"
        }));

        setStatus("接続完了");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch("/api/realtime-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      const answer = await response.text();

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer
      });

    } catch (error) {
      console.error(error);
      setStarted(false);
      setStatus("許可または接続失敗");
    }
  }

  return (
    <main className="screen">
      <audio autoPlay playsInline ref={remoteAudioRef} />

      <div className="centerArea">
        <div className="avatar">
          <div className="hair"></div>

          <div className="face">
            <div className="eyes">
              <span></span>
              <span></span>
            </div>

            <div className="mouth"></div>
          </div>
        </div>

        <div className="message">
          こんにちは😊<br />
          なにかお困りですか？<br />
          そのまま話してください♪
        </div>

        <button className="callButton" onClick={startAI} disabled={started}>
          AIスタッフを呼ぶ
        </button>

        <div className="status">
          {status}
        </div>
      </div>

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="camera"
      />
    </main>
  );
}
