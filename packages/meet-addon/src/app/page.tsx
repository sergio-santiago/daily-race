import Link from 'next/link';

export default function LandingPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: 32,
        gap: 20,
      }}
    >
      <span style={{ fontSize: 64 }} aria-hidden="true">
        🏁
      </span>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Daily Race
      </h1>
      <p
        style={{
          maxWidth: 520,
          color: 'var(--color-text-secondary)',
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        Gamificacion F1 de la daily de Secture, en directo dentro de Google Meet
        y Google Chat.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link
          href="/sidepanel"
          style={{
            padding: '10px 18px',
            background: 'var(--color-live)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: '#fff',
          }}
        >
          Ver side panel
        </Link>
        <Link
          href="/mainstage"
          style={{
            padding: '10px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Ver main stage
        </Link>
      </div>
      <small
        style={{ color: 'var(--color-text-tertiary)', marginTop: 32, fontSize: 12 }}
      >
        Esta web es el add-on de Google Meet. Las rutas /sidepanel y /mainstage
        se cargan dentro del iframe de Meet cuando los usuarios abren el add-on.
      </small>
    </main>
  );
}
