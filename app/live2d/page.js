export default function Live2DPage() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: transparent;
            overflow: hidden;
            width: 280px;
            height: 320px;
          }
          canvas {
            display: block;
          }
        `}</style>
      </head>
      <body>
        <canvas id="live2d" width="280" height="320" />
        <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js" />
        <script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js" />
        <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js" />
        <script dangerouslySetInnerHTML={{ __html: `
          (async function() {
            try {
              const app = new PIXI.Application({
                view: document.getElementById('live2d'),
                width: 280,
                height: 320,
                backgroundAlpha: 0,
                transparent: true,
              });

              const model = await PIXI.live2d.Live2DModel.from('/live2d/model.model3.json');

              app.stage.addChild(model);

              const scaleX = 280 / model.width;
              const scaleY = 320 / model.height;
              const scale = Math.min(scaleX, scaleY) * 0.9;

              model.scale.set(scale);
              model.x = 280 / 2 - (model.width * scale) / 2;
              model.y = 320 / 2 - (model.height * scale) / 2;

            } catch(e) {
              console.error('Live2D error:', e);
            }
          })();
        `}} />
      </body>
    </html>
  );
}
