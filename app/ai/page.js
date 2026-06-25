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
  const dataChannelRef = useRef(null);
  const greetingDoneRef = useRef(false);
  const lastTranscriptRef = useRef("");

  const STAFF_INSTRUCTIONS = `
あなたはコインランドリー西本町店の現場スタッフです。
ChatGPTではありません。説明ロボットでもありません。

# 言語・発音
必ず日本語だけで話してください。英語や他の言語は一切使わないでください。
日本語ネイティブの自然な発音とイントネーションで話してください。
外国語なまりや帰国子女のような発音にならないようにしてください。

# ペーシング
返答はすばやく始めてください。
話すスピードは自然な会話のテンポで、もたつかないようにしてください。
考え込む間を作らないでください。

# 基本人格
女性スタッフのように親しみやすく、短く、やさしく、落ち着いて話してください。
高齢のお客様にも分かる言葉で話してください。
いらっしゃいませ、ごゆっくり、ゆっくり選んでください、などの物販店の接客言葉は使わない。

# 店舗情報
このお店は無人店舗です。
スタッフは常駐していません。
「スタッフを呼びます」「スタッフが参ります」「スタッフが常駐しています」は絶対に言わない。
「スタッフを呼んでほしい」と言われたら「こちらからスタッフを呼ぶことはできません。困ったときは店内に掲示している緊急連絡先へお電話ください」と案内する。
緊急時や困りごとが解決しない場合も、店内に掲示している緊急連絡先へお電話くださいと案内する。

# 最重要
最初から写真やカメラを求めない。
まず会話で問診する。
見ないと判断できない時だけ写真をお願いする。

# 無音・雑音
無音、雑音、物音、機械音、咳、衣擦れ、周囲の会話には反応しない。
内容が不明瞭なら勝手に推測して話さない。

# 基本フロー
1. まず共感する
2. 会話で問診する
3. 追加質問する
4. 会話で解決できるなら写真は求めない
5. 見ないと判断できない時だけ写真をお願いする

# 禁止
買い替え、修理、交換を勝手に勧めない。
見えていないのに「確認しました」「見えました」と言わない。
長文、専門家口調、説教、議論、クレームへの反論は禁止。

# 乾かない相談
最初に写真を求めない。
「それは困りましたね」と受け止める。
何を乾燥したか、量、乾燥時間、大型乾燥機か、毛布や厚手物かを短く確認する。

# 操作方法
山本製作所の洗濯乾燥機・水洗機、IPSOの水洗機・乾燥機は、
お金を入れる → コースを選ぶ → もう一度コースボタンを押す → スタート。

# 温度設定
西本町店では、低温55度、中温65度、高温75度。

# 緊急対応
異音、焦げ臭い、発煙、水漏れ、危険を感じる場合は、利用を止めるよう案内し、店内掲示の緊急連絡先へお電話くださいと案内する。

回答は原則3文以内。
`;

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

    dataChannelRef.current = null;
    greetingDoneRef.current = false;
    lastTranscriptRef.current = "";

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

  function sendOpenAIGreeting(dc) {
    if (greetingDoneRef.current) return;
    greetingDoneRef.current = true;

    if (!dc || dc.readyState !== "open") return;

    dc.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "次のセリフをそのまま読んでください。一言も変えないでください。「AIスタッフです。ご用件をお伺いします。」"
          }
        ]
      }
    }));

    dc.send(JSON.stringify({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: "「AIスタッフです。ご用件をお伺いします。」このセリフだけを読んでください。それ以外は何も言わないでください。"
      }
    }));
  }

  function handleRealtimeEvent(event) {
    let data = null;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    // create_response: true にしたのでhandleRealtimeEventは状態表示のみ
    if (data?.type === "response.audio.delta") {
      setStatus("返答中");
    }

    if (data?.type === "response.done") {
      setStatus("接続完了");
    }
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
      dataChannelRef.current = dc;
      dc.onmessage = handleRealtimeEvent;

      dc.onopen = () => {
        if (greetingDoneRef.current) return;

        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: STAFF_INSTRUCTIONS,
            output_modalities: ["audio"],
            audio: {
              input: {
                transcription: {
                  model: "whisper-1"
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.98,
                  prefix_padding_ms: 500,
                  silence_duration_ms: 1500,
                  create_response: true,      // 即座に返答
                  interrupt_response: true
                }
              },
              output: {
                voice: "shimmer"
              }
            }
          }
        }));

        setTimeout(() => {
          sendOpenAIGreeting(dc);
          setStatus("接続完了");
        }, 500);
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

  async function sendPhotoToVision() {
    if (!capturedImage) {
      setStatus("送信する写真がありません");
      return;
    }

    try {
      setStatus("写真を解析中です");

      const response = await fetch("/api/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: capturedImage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "画像解析に失敗しました");
      }

      const result = data?.result || "写真を確認しました。";

      setStatus("写真を確認しました");

      const dc = dataChannelRef.current;

      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "お客様が写真を送信しました。以下は写真解析結果です。西本町店の現場スタッフとして、見えている事実、考えられる可能性、次に確認したいことを短く案内してください。買い替え、修理、交換は勝手に勧めないでください。ランドリー機器と関係ない写真なら、何を確認したいか質問してください。写真解析結果：" + result
              }
            ]
          }
        }));

        dc.send(JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: "必ず日本語で話してください。3文以内で短く案内してください。"
          }
        }));
      } else {
        setStatus("写真を確認しました。AI接続後に案内できます");
      }
    } catch (error) {
      console.error(error);
      setStatus(`画像解析失敗: ${error.message || "不明なエラー"}`);
    }
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

              <button className="sendPhotoButton" onClick={sendPhotoToVision}>
                写真を送る
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
