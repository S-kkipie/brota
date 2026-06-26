import Link from "next/link";

const features = [
  {
    title: "Por WhatsApp",
    body: "Sin app que descargar. Hablas con Brota como a un amigo y empiezas a ahorrar.",
  },
  {
    title: "En dólares, con yield",
    body: "Tu ahorro se guarda en dólares y rinde solo, vía bóvedas DeFindex sobre Stellar.",
  },
  {
    title: "Coach IA en español",
    body: "Te enseña y te acompaña. La IA sugiere y redacta; tú firmas. Nunca toca tus llaves.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-emerald-600">
          PULSO Hackathon · Stellar
        </p>
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Brota
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-foreground/70">
          Ahorra en dólares <strong>por WhatsApp</strong>, con una IA que te enseña — y la plata
          que guardas <strong>rinde sola</strong>. Sin app, sin saber cripto.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/demo"
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700"
          >
            Ver demo
          </Link>
          <a
            href="https://github.com/S-kkipie/brota"
            className="rounded-full border border-foreground/15 px-6 py-3 font-medium transition hover:bg-foreground/5"
          >
            GitHub
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-foreground/10 p-6">
            <h2 className="text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
