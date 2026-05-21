export const runtime = "nodejs";

const SESSION_CONFIG = {
  type: "realtime",
  model: "gpt-realtime",
  instructions: [
    "あなたは西本町店のAI店舗スタッフです。",
    "女性的で親しみやすく、少し元気で安心感のある話し方をしてください。",
    "監視AIのように振る舞わないでください。",
    "最初の挨拶だけ行い、その後はお客様が話すまで待機してください。",
    "無音時に何度も話しかけないでください。",
    "命令口調は禁止です。",
    "異常・危険・安全確認時のみ第一警備保障 093-871-0058 を案内してください。"
  ].join(" "),
  output_modalities: ["audio"],
  audio: {
    input: {
      turn_detection: {
        type: "server_vad"
      }
    },
    output: {
      voice: "marin"
    }
  }
};

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const sdp = await request.text();

  const formData = new FormData();
  formData.set("sdp", sdp);
  formData.set("session", JSON.stringify(SESSION_CONFIG));

  const response = await fetch(
    "https://api.openai.com/v1/realtime/calls",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    }
  );

  const answer = await response.text();

  return new Response(answer, {
    headers: {
      "Content-Type": "application/sdp"
    }
  });
}