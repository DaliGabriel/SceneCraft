import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    const zip = new JSZip();

    // Fetch and add each image to the zip
    const imagePromises = images.map(
      async (imageUrl: string, index: number) => {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image ${index + 1}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          zip.file(`image-${index + 1}.webp`, arrayBuffer);
        } catch (error) {
          console.error(`Error processing image ${index + 1}:`, error);
          throw error;
        }
      }
    );

    await Promise.all(imagePromises);

    // Generate the zip file
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
    });

    // Return the zip file
    return new NextResponse(zipBlob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="generated-images.zip"',
      },
    });
  } catch (error) {
    console.error("Error creating zip:", error);
    return NextResponse.json(
      { error: "Failed to create zip file" },
      { status: 500 }
    );
  }
}
