export default function Home() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
        Daily Race
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#888' }}>Coming soon</p>
    </main>
  );
}
