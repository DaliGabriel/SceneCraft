import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import JSZip from 'jszip';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(request: Request) {
    try {
        const { dialogue } = await request.json();

        if (!dialogue) {
            return NextResponse.json(
                { error: 'Dialogue is required' },
                { status: 400 }
            );
        }

        // Split dialogue into sections and generate prompts
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `
You are a helpful assistant that splits dialogue into logical sections and generates creative image prompts.
For each section, provide a concise, vivid description that would make a good image prompt.
Return ONLY a JSON array of objects with 'section' and 'prompt' properties, nothing else.`,
                },
                {
                    role: 'user',
                    content: dialogue,
                },
            ],
        });

        const sections = JSON.parse(completion.choices[0]?.message?.content || '[]');
        if (!Array.isArray(sections)) {
            throw new Error('Invalid sections format from OpenAI.');
        }

        const zip = new JSZip();
        let successfulGenerations = 0;
        let lastRequestTime = Date.now();
        const MIN_DELAY_BETWEEN_REQUESTS = 120000; // 2 minutes

        console.log('\n=== Starting image generation ===');
        console.log('Initial delay to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_REQUESTS));

        // Process images sequentially to avoid 429 errors
        for (let index = 0; index < sections.length; index++) {
            const section = sections[index];
            let retries = 3;
            let lastErrorTime = 0;

            while (retries > 0) {
                try {
                    // Calculate time since last request
                    const timeSinceLastRequest = Date.now() - lastRequestTime;
                    if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
                        const waitTime = MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest;
                        console.log(`\nWaiting ${Math.ceil(waitTime / 1000)} seconds before next request...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    console.log(`\nGenerating image ${index + 1}/${sections.length}...`);
                    lastRequestTime = Date.now();

                    const imageResponse = await openai.images.generate({
                        model: 'dall-e-3',
                        prompt: section.prompt,
                        size: '1024x1024',
                        quality: 'standard',
                        n: 1,
                    });

                    const imageUrl = imageResponse.data?.[0]?.url;
                    if (!imageUrl) {
                        console.warn(`Warning: Failed to generate image for prompt: ${section.prompt}`);
                        break;
                    }

                    const imageFetchResponse = await fetch(imageUrl);
                    const imageBuffer = await imageFetchResponse.arrayBuffer();
                    zip.file(`scene-${index + 1}.png`, imageBuffer);
                    successfulGenerations++;
                    console.log(`✓ Successfully generated image ${index + 1}`);

                    // If we had a rate limit error before, wait longer
                    if (lastErrorTime > 0) {
                        const additionalWait = 180000; // 3 minutes
                        console.log(`\n=== Rate limit detected, waiting ${additionalWait / 1000} seconds ===`);
                        await new Promise(resolve => setTimeout(resolve, additionalWait));
                    }

                    break;
                } catch (error: unknown) {
                    console.log(error);
                    lastErrorTime = Date.now();
                    retries--;

                    if (retries === 0) {
                        console.error(`Failed to generate image after 3 retries: ${section.prompt}`);
                    } else {
                        const waitTime = Math.min(300000, 30000 * Math.pow(2, 3 - retries)); // Exponential backoff
                        console.log(`\nRate limit hit. Waiting ${waitTime / 1000} seconds before retry attempt ${3 - retries}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }
        }

        if (successfulGenerations === 0) {
            return NextResponse.json(
                {
                    error: 'Failed to generate any images due to rate limiting. This usually means you\'ve hit OpenAI\'s API limits. Please try one of these solutions:\n1. Wait 5-10 minutes before trying again\n2. Upgrade your OpenAI API plan for higher rate limits\n3. Try with a shorter dialogue that generates fewer images',
                    details: 'All image generation attempts failed with status code 429 (Too Many Requests)'
                },
                { status: 429 }
            );
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="storyboard.zip"',
            },
        });
    } catch (error) {
        console.error('Error processing dialogue:', error);
        return NextResponse.json(
            { error: 'Failed to process dialogue' },
            { status: 500 }
        );
    }
}
