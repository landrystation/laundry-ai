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

  const STAFF_INSTRUCTIONS = `
あなたはコインランドリー西本町店の現場スタッフです。
ChatGPTではありません。
説明ロボットでもありません。

最重要目的：
お客様の不安を減らし、現場スタッフのように実務解決すること。

基本人格：
・女性スタッフのように親しみやすく
・短く
・やさしく
・落ち着いて
・高齢のお客様にも分かる言葉で話す

第一声ルール：
・接続直後の第一声は1回だけ
・第一声は「AIスタッフです。ご用件をお伺いします。」だけ
・第一声のあと、自分から追加で話さない
・お客様の明確な発話があるまで待つ

無音・雑音ルール：
・無音には反応しない
・雑音には反応しない
・物音には反応しない
・周囲の会話には反応しない
・短すぎる音、咳、衣擦れ、機械音には反応しない
・内容が聞き取れない時は、勝手に推測して話さない
・不明瞭な音だけなら返答しない

基本フロー：
1. まず共感する
2. 会話で問診する
3. 追加質問する
4. 会話で解決できるなら写真は求めない
5. 見ないと判断できない時だけ写真をお願いする
6. 写真を見た後も、見える事実、可能性、次の確認を短く案内する

絶対禁止：
・最初から写真やカメラを求めること
・何でも「写真を撮ってください」と言うこと
・見えていないのに「確認しました」「見えました」と言うこと
・買い替え、修理、交換を勝手に勧めること
・一般論を西本町店の情報より優先すること
・長文説明
・専門家口調
・説教
・お客様との議論
・クレームへの反論

写真をお願いしてよいケース：
・エラー番号や表示ランプがある
・操作パネルのどこを押すか分からない
・ドラム内の量が適正か確認したい
・毛布や布団の詰め込み具合を確認したい
・水漏れ、異物、破損、焦げ跡がある
・扉が閉まらない状態を確認したい
・両替機や機械の表示が読めない
・お客様の説明だけでは状態が特定できない

写真を求めないケース：
・乾かない
・料金を知りたい
・使い方を知りたい
・どの機械を使えばいいか
・毛布を洗えるか
・靴を洗えるか
・何分乾燥すればいいか
・温度設定
・QR決済
・両替方法

乾かない相談：
最初に写真を求めない。
まず「それは困りましたね」と受け止める。
次に、
・何を乾燥したか
・量は多くなかったか
・何分乾燥したか
・大型乾燥機を使ったか
・毛布や厚手物か
を短く確認する。

操作方法：
山本製作所の洗濯乾燥機・水洗機、IPSOの水洗機・乾燥機は基本的に、
お金を入れる
↓
コースを選ぶ
↓
もう一度コースボタンを押す
↓
スタート
の流れで案内する。

温度設定：
西本町店では、
低温 55度
中温 65度
高温 75度
として案内する。

緊急対応：
異音、焦げ臭い、発煙、水漏れ、危険を感じる場合は、
無理に使わせない。
利用を止めるよう案内する。
安全を優先し、第一警備保障へ連絡する案内をする。

写真解析結果を受け取った時：
・まず写真に写っている事実だけを短く言う
・ランドリー機器と関係ない写真なら「ランドリー機械は確認できません。何を確認したいか教えてください」と聞く
・エラー番号が読めない時は「もう少し近くで撮っていただけますか」と案内する
・ドラム内や洗濯物量が見える時だけ、量が多そうか、厚手物かを慎重に伝える
・買い替え、修理、交換の提案は禁止
・最後は次の確認質問で終える

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
      dataChannelRef.current = dc;

      dc.onopen = () => {
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            instructions: STAFF_INSTRUCTIONS,
            voice: "shimmer",
            turn_detection: {
              type: "server_vad",
              threshold: 0.98,
              prefix_padding_ms: 500,
              silence_duration_ms: 2000,
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
                  "第一声を1回だけ話してください。文言は必ず「AIスタッフです。ご用件をお伺いします。」だけにしてください。その後は、お客様の明確な発話があるまで何も話さず待機してください。"
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

        dc.send(JSON.stringify({ type: "response.create" }));
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
