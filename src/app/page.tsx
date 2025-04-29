"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [text, setText] = useState("");
  const [results, setResults] = useState<
    Array<{ paragraph: string; imageUrl: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate images");
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError("An error occurred while processing your request");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (results.length === 0) return;

    setDownloading(true);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: results.map((result) => result.imageUrl),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to download images");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-images.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Failed to download images");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {!showGenerator ? (
        // Landing Page
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-end mb-4">
            <Link href="/en" className="text-indigo-600 hover:text-indigo-800">
              English
            </Link>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">SceneCraft</h1>
          <p className="text-xl text-gray-700 mb-8">
            &ldquo;Convierte tu historia o diálogo en imágenes
            automáticamente.&rdquo;
          </p>
          <p className="text-lg text-gray-600 mb-12">
            Escribe un texto, genera imágenes para cada escena, ahorra horas de
            trabajo creativo.
          </p>
          <button
            onClick={() => setShowGenerator(true)}
            className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Generar imágenes ahora
          </button>
        </div>
      ) : (
        // Generator Page
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => setShowGenerator(false)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              ← Volver a la página principal
            </button>
            <Link href="/en" className="text-indigo-600 hover:text-indigo-800">
              English
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="mb-8">
            <div className="mb-4">
              <label
                htmlFor="text"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Ingresa tu texto
              </label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                rows={6}
                placeholder="Escribe tu texto aquí..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Procesando..." : "Generar Imágenes"}
            </button>
          </form>

          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mb-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {downloading
                  ? "Descargando..."
                  : "Descargar Todas las Imágenes"}
              </button>
            </div>
          )}

          <div className="space-y-8">
            {results.map((result, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow">
                <p className="mb-4 text-gray-700">{result.paragraph}</p>
                {result.imageUrl && (
                  <div className="relative aspect-square w-full">
                    <Image
                      src={result.imageUrl}
                      alt={`Imagen generada para el párrafo ${index + 1}`}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
