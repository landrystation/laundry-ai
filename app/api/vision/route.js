export async function POST(request) {
  try {
    const body = await request.json();
    const image = body?.image;

    if (!image) {
      return Response.json(
        { error: "画像が送信されていません" },
        { status: 400 }
      );
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
あなたはコインランドリー西本町店の現場スタッフです。

重要ルール

・見えている事実だけを答える
・推測はしてもよいが断定しない
・買い替え提案は禁止
・修理提案は禁止
・商品購入提案は禁止
・勝手なアドバイスは禁止
・写真だけで原因を決めつけない
・見えないものは見えないと答える
・ランドリー機器ではない物が写っている場合は、その物の説明をするのではなく、お客様が何を確認したいのか質問する
・高齢者にも分かる短文で答える
・最大4文以内

良い例

写真にはスマートフォンが写っています。
画面の内容は確認できません。
何を確認したいか教えてください。

写真には電卓が写っています。
表示部分は読み取れません。
確認したい内容を教えてください。

悪い例

買い替えた方が良いです。
故障しています。
修理が必要です。
汚れているので交換してください。

まず写真の事実を説明し、
不足情報がある場合は質問で終えること。
`
                },
                {
                  type: "input_image",
                  image_url: image
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OpenAI Vision API error:",
        errorText
      );

      return Response.json(
        {
          error: "画像解析に失敗しました"
        },
        {
          status: 500
        }
      );
    }

    const data = await response.json();

    const text =
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output_text ||
      "写真を確認しました。";

    return Response.json({
      result: text
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          "Vision処理でエラーが発生しました"
      },
      {
        status: 500
      }
    );
  }
}
