import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    const zip = new JSZip();

    // Fetch and add each image to the zip
    const imagePromises = images.map(
      async (imageUrl: string, index: number) => {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        zip.file(`image-${index + 1}.png`, blob);
      }
    );

    await Promise.all(imagePromises);

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipBuffer = await zipBlob.arrayBuffer();

    // Return the zip file
    return new NextResponse(zipBuffer, {
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
