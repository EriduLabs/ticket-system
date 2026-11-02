import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ArtistPage from './components/ArtistPage';
import ScannerPage from './components/ScannerPage';
import TicketDesigner from './components/TicketDesigner';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="nav-brand">
            <img src="/tms-logo.png" alt="This Is Music" className="brand-logo tms-logo" onError={(e) => e.target.style.display='none'} />
            <span className="brand-divider">x</span>
            <img src="/elabs-logo.png" alt="Elabs" className="brand-logo elabs-logo" onError={(e) => e.target.style.display='none'} />
          </div>
          <div className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link to="/scanner">Scanner</Link>
          </div>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/landing/:slug" element={<ArtistPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/design/:allocationId" element={<TicketDesigner />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
