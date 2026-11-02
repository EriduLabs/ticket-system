import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';

const ScannerPage = () => {
  const [ticketId, setTicketId] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${window.location.protocol}//${window.location.hostname}:8000/api/tickets/${ticketId}/scan/`);
      setScanResult({ success: true, message: res.data.message });
      setTicketId('');
    } catch (err) {
      if (err.response && err.response.data) {
        setScanResult({ success: false, message: err.response.data.message });
      } else {
        setScanResult({ success: false, message: 'Scan failed due to a network error.' });
      }
    }
  };

  return (
    <motion.div className="scanner-page glass-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="scanner-header">
        <ScanLine size={48} className="scan-icon" />
        <h2>Event Scanner Terminal</h2>
      </div>
      <p className="scanner-desc">Secure validation node. Paste UUID for manual override validation.</p>
      
      <form onSubmit={handleScan} className="scan-form">
        <input 
          type="text" 
          value={ticketId}
          onChange={e => setTicketId(e.target.value)}
          placeholder="Enter Ticket UUID..."
          className="scan-input dark-input"
          required
        />
        <button type="submit" className="btn-primary glow-green">Validate Ticket</button>
      </form>

      {scanResult && (
        <motion.div className={`scan-result ${scanResult.success ? 'success' : 'error'}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h3>{scanResult.success ? '✅ AUTHORIZED' : '❌ DENIED'}</h3>
          <p>{scanResult.message}</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ScannerPage;
