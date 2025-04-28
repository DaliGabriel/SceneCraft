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

    // Part the text manually into paragraphs
    const paragraphs = text
      .split(/\n{2,}/) // Split by double newlines
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    if (paragraphs.length === 0) {
      throw new Error("No valid paragraphs found in input text");
    }

    // Now ask OpenAI to generate visual prompts for each paragraph
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Mejor para formato JSON
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are a visual storytelling expert.
For each paragraph provided, generate a rich, vivid, cinematic image prompt.

Instructions for each prompt:
- Describe environment, lighting, emotions, and key actions
- Be vivid but concise
- Present tense
- Include camera angle or shot type if useful
- No extra commentary, only the array output

Return JSON array of objects like:
[
  {
    "original": "Original paragraph here",
    "prompt": "Generated cinematic prompt here"
  }
]
`,
        },
        {
          role: "user",
          content: JSON.stringify(paragraphs),
        },
      ],
    });

    const responseContent = completion.choices[0].message.content;
    console.log(responseContent);

    if (!responseContent) {
      throw new Error("No content received from OpenAI");
    }

    let scenes: Array<{ original: string; prompt: string }>;
    try {
      const parsed = JSON.parse(responseContent);
      // Handle the specific GPT response format with result array
      if (parsed.result && Array.isArray(parsed.result)) {
        scenes = parsed.result.map(
          (item: { original: string; prompt: string }) => ({
            original: item.original,
            prompt: item.prompt,
          })
        );
      } else {
        throw new Error(
          "Invalid response format: missing or invalid result array"
        );
      }
    } catch (error) {
      console.error("Parse error:", error);
      console.error("Response content:", responseContent);
      throw new Error("Failed to parse OpenAI response");
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error("No valid scenes found in OpenAI response");
    }

    // Generate images for each scene
    const imagePromises = scenes.map(async (scene) => {
      const output = await replicate.run("black-forest-labs/flux-schnell", {
        input: {
          prompt: scene.prompt,
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
        paragraph: scene.original,
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
