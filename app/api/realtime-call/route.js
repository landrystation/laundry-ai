export async function POST(request) {
  try {
    const offerSdp = await request.text();

    const response = await fetch(
      "https://api.openai.com/v1/realtime/calls?model=gpt-realtime-2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: offerSdp,
      }
    );

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
