import { QrWorkspace } from "@/components/qr-workspace";

export default function Home() {
  return (
    <div className="min-h-0 flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 px-4 py-8 text-center backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
          QR code generator
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
          Encode URLs, text, Wi‑Fi credentials, or image links. Add an optional
          background and center logo, then download a PNG—all in your browser.
        </p>
      </header>
      <QrWorkspace />
    </div>
  );
}
