"use client";

import { useRef, useState } from "react";

export default function AIPage() {
  const [status, setStatus] = useState("待機中");
  const [started, setStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const canvasRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaStreamRef = useRef(null);

  function isBackCameraLabel(label) {
    const text = String(label || "").toLowerCase();

    return (
      text.includes("back") ||
      text.includes("rear") ||
      text.includes("environment") ||
      text.includes("facing back") ||
      text.includes("背面") ||
      text.includes("アウト")
    );
  }

  function isFrontCameraLabel(label) {
    const text = String(label || "").toLowerCase();

    return (
      text.includes("front") ||
      text.includes("user") ||
      text.includes("facing front") ||
      text.includes("前面") ||
      text.includes("イン")
    );
  }

  function stopAll() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }

  function getErrorMessage(error) {
    if (!error) return "不明なエラー";
    if (error.name === "NotAllowedError") return "マイクまたはカメラの許可が必要です";
    if (error.name === "NotFoundError") return "マイクまたはカメラが見つかりません";
    if (error.name === "NotReadableError") return "マイクまたはカメラを他のアプリが使用中です";
    if (error.name === "OverconstrainedError") return "カメラ条件が合いません";
    if (error.message) return error.message;
    return "接続に失敗しました";
  }

  async function getAudioStream() {
    setStatus("マイク許可待ち");

    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  async function getCameraStream() {
    setStatus("カメラ許可待ち");

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    } catch (firstCameraError) {
      console.warn("Environment camera fallback:", firstCameraError);

      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
    }
  }

  async function selectBackCameraIfPossible(currentCameraStream) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");

      if (videoDevices.length <= 1) return currentCameraStream;

      const currentTrack = currentCameraStream.getVideoTracks()[0];
      const currentLabel = currentTrack?.label || "";

      if (currentLabel && isBackCameraLabel(currentLabel)) return currentCameraStream;

      const backCamera =
        videoDevices.find((device) => isBackCameraLabel(device.label)) ||
        videoDevices.find((device) => !isFrontCameraLabel(device.label));

      if (!backCamera?.deviceId) return currentCameraStream;

      const backCameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { ideal: backCamera.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      currentCameraStream.getTracks().forEach((track) => track.stop());

      return backCameraStream;
    } catch (error) {
      console.warn("Back camera selection skipped:", error);
      return currentCameraStream;
    }
  }

  async function attachLocalCamera(cameraStream) {
    if (!localVideoRef.current || !cameraStream) return;

    const videoTracks = cameraStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    localVideoRef.current.srcObject = new MediaStream(videoTracks);

    try {
      await localVideoRef.current.play();
    } catch (error) {
      console.warn("Local camera preview play skipped:", error);
    }
  }

  async function startAI() {
    if (started) return;

    setStarted(true);
    stopAll();

    let audioStream = null;
    let cameraStream = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("このブラウザはマイク・カメラに対応していません");
      }

      audioStream = await getAudioStream();

      try {
        cameraStream = await getCameraStream();
        cameraStream = await selectBackCameraIfPossible(cameraStream);
        await attachLocalCamera(cameraStream);
      } catch (cameraError) {
        console.warn("Camera unavailable. Continue with audio only:", cameraError);
        setStatus("カメラなしでAI接続中");
      }

      const combinedStream = new MediaStream([
        ...audioStream.getAudioTracks(),
        ...(cameraStream ? cameraStream.getVideoTracks() : [])
      ]);

      mediaStreamRef.current = combinedStream;

      const audioTracks = combinedStream.getAudioTracks();
      if (audioTracks.length === 0) throw new Error("マイクを取得できませんでした");

      const videoLabel = combinedStream.getVideoTracks()[0]?.label || "";

      if (videoLabel && isBackCameraLabel(videoLabel)) {
        setStatus("背面カメラでAI接続中");
      } else if (combinedStream.getVideoTracks().length > 0) {
        setStatus("カメラ付きでAI接続中");
      } else {
        setStatus("音声のみでAI接続中");
      }

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      audioTracks.forEach((track) => {
        pc.addTrack(track, combinedStream);
      });

      pc.ontrack = async (event) => {
        if (!remoteAudioRef.current) return;

        remoteAudioRef.current.srcObject = event.streams[0];

        try {
          await remoteAudioRef.current.play();
        } catch (error) {
          console.warn("Remote audio play skipped:", error);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("接続完了");

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setStatus(`接続状態: ${pc.connectionState}`);
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
                text:
                  "こんにちは😊 なにかお困りですか？ そのまま話してください♪ この挨拶は1回だけ行い、その後は無音時・雑音・物音・周囲の音には反応せず、お客様の明確な発話があるまで待機してください。"
              }
            ]
          }
        }));

        dc.send(JSON.stringify({ type: "response.create" }));
        setStatus("接続完了");
      };

      dc.onerror = (error) => {
        console.error("Data channel error:", error);
        setStatus("会話チャンネル失敗");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch("/api/realtime-call", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp
      });

      if (!response.ok) throw new Error("Realtime API接続に失敗しました");

      const answer = await response.text();

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer
      });
    } catch (error) {
      console.error(error);
      stopAll();
      setStarted(false);
      setStatus(`失敗: ${getErrorMessage(error)}`);
    }
  }

  function capturePhoto() {
    const video = localVideoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setStatus("カメラ映像がまだ準備できていません");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    setCapturedImage(imageDataUrl);
    setStatus("写真を確認してください");
  }

  function retakePhoto() {
    setCapturedImage(null);
    setStatus("もう一度撮影できます");
  }

  function sendPhotoPlaceholder() {
    if (!capturedImage) {
      setStatus("送信する写真がありません");
      return;
    }

    setStatus("写真を受け取りました。解析機能は次に接続します");
  }

  return (
    <main className="screen">
      <audio autoPlay playsInline ref={remoteAudioRef} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

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

        <div className="status">{status}</div>
      </div>

      <div className="cameraArea">
        {!capturedImage && (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="camera"
            />

            <button className="shutterButton" onClick={capturePhoto}>
              写真を撮る
            </button>
          </>
        )}

        {capturedImage && (
          <div className="photoPreviewArea">
            <img
              src={capturedImage}
              alt="撮影した写真"
              className="photoPreview"
            />

            <div className="photoButtons">
              <button className="retakeButton" onClick={retakePhoto}>
                撮り直す
              </button>

              <button className="sendPhotoButton" onClick={sendPhotoPlaceholder}>
                写真を送る
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
