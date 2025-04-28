import { NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    // Split text into paragraphs using OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that splits text into meaningful paragraphs. Return the paragraphs as a JSON array of strings.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    const paragraphs = JSON.parse(
      completion.choices[0].message.content || '{"paragraphs": []}'
    ).paragraphs;

    // Generate images for each paragraph
    const imagePromises = paragraphs.map(async (paragraph: string) => {
      const output = await replicate.run("black-forest-labs/flux-schnell", {
        input: {
          prompt: paragraph,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80,
          num_inference_steps: 4,
        },
      });
      return {
        paragraph,
        imageUrl: (output as { url: () => string }[])[0].url(),
      };
    });

    const results = await Promise.all(imagePromises);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
