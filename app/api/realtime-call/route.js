export async function POST(request) {
  try {
    const offerSdp = await request.text();

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-realtime-2",
      audio: {
        output: {
          voice: "shimmer",
        },
      },
    });

    const formData = new FormData();
    formData.append("sdp", new Blob([offerSdp], { type: "application/sdp" }), "sdp");
    formData.append("session", new Blob([sessionConfig], { type: "application/json" }), "session");

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Realtime API error:", errorText);
      return new Response("OpenAI Realtime API error", {
        status: 500,
      });
    }

    const answerSdp = await response.text();

    return new Response(answerSdp, {
      headers: {
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Realtime session failed", {
      status: 500,
    });
  }
}
