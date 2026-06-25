export default function Live2DPage() {
  return (
    <div style={{ width: "280px", height: "320px", overflow: "hidden" }}>
      <canvas id="live2d" width="280" height="320" style={{ display: "block" }} />
      <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js" />
      <script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js" />
      <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js" />
      <script dangerouslySetInnerHTML={{ __html: `
        window.addEventListener('load', async function() {
          try {
            const app = new PIXI.Application({
              view: document.getElementById('live2d'),
              width: 280,
              height: 320,
              backgroundAlpha: 0,
            });
            const model = await PIXI.live2d.Live2DModel.from('/live2d/model.model3.json');
            app.stage.addChild(model);
            const scale = Math.min(280 / model.width, 320 / model.height) * 0.9;
            model.scale.set(scale);
            model.x = 280 / 2 - (model.width * scale) / 2;
            model.y = 320 / 2 - (model.height * scale) / 2;
          } catch(e) {
            console.error('Live2D error:', e);
          }
        });
      `}} />
    </div>
  );
}
