export default function Header({ isConnected }) {
  return (
    <header className="header">
      <div className="header-content">
        <h1>🛡️ SEO Shield Proxy</h1>
        <p>Real-time Admin Dashboard</p>
      </div>
      <div className="connection-status">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
    </header>
  );
}
