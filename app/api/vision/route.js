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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "あなたはコインランドリー西本町店の現場スタッフです。写真を見て、利用者が困っていそうな点を短く分かりやすく説明してください。断定しすぎず、見えている範囲だけを答えてください。高齢者にも分かるように、専門用語を避けてください。"
              },
              {
                type: "input_image",
                image_url: image
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Vision API error:", errorText);

      return Response.json(
        { error: "画像解析に失敗しました" },
        { status: 500 }
      );
    }

    const data = await response.json();

    const text =
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output_text ||
      "画像を確認しましたが、内容を読み取れませんでした。";

    return Response.json({
      result: text
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Vision処理でエラーが発生しました" },
      { status: 500 }
    );
  }
}
