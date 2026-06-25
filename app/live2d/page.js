"use client";

import { useEffect } from "react";

export default function Live2DPage() {
  useEffect(() => {
    async function init() {
      try {
        const PIXI = await import("pixi.js");
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");

        window.PIXI = PIXI;

        await loadScript("https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js");

        const app = new PIXI.Application({
          view: document.getElementById("live2d-canvas"),
          width: 280,
          height: 320,
          backgroundAlpha: 0,
        });

        const model = await Live2DModel.from("/live2d/model.model3.json", {
          ticker: PIXI.Ticker.shared,
        });

        app.stage.addChild(model);

        const scale = Math.min(280 / model.width, 320 / model.height) * 0.9;
        model.scale.set(scale);
        model.x = 280 / 2 - (model.width * scale) / 2;
        model.y = 320 / 2 - (model.height * scale) / 2;

      } catch (e) {
        console.error("Live2D error:", e);
        const el = document.getElementById("live2d-error");
        if (el) el.textContent = "エラー: " + e.message;
      }
    }

    init();
  }, []);

  return (
    <div style={{ width: "280px", height: "320px", overflow: "hidden", background: "transparent" }}>
      <canvas id="live2d-canvas" width="280" height="320" style={{ display: "block" }} />
      <p id="live2d-error" style={{ color: "red", fontSize: "12px" }} />
    </div>
  );
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("読み込み失敗: " + src));
    document.head.appendChild(script);
  });
}
