import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ScanLine, Camera, CameraOff, CheckCircle2, RotateCcw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const ScannerPage = () => {
  const [ticketId, setTicketId] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchTickets();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`/api/tickets/`);
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const validateAndCheckIn = async (identifier) => {
    const cleanId = (identifier || '').trim().replace(/^#/, '');
    if (!cleanId) return;
    try {
      const res = await axios.post(
        `/api/tickets/${encodeURIComponent(cleanId)}/scan/`
      );
      setScanResult({
        success: true,
        message: res.data.message,
        ticket: res.data.ticket,
      });
      setTicketId('');
      fetchTickets();
    } catch (err) {
      if (err.response && err.response.data) {
        setScanResult({
          success: false,
          message: err.response.data.message || 'Ticket validation failed.',
          ticket: err.response.data.ticket || null,
        });
      } else {
        setScanResult({ success: false, message: 'Scan failed due to a network error.' });
      }
      fetchTickets();
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    await validateAndCheckIn(ticketId);
  };

  const handleResetTicket = async (id) => {
    try {
      await axios.post(
        `/api/tickets/${id}/status/`,
        { status: 'VALID' }
      );
      fetchTickets();
    } catch (err) {
      alert('Failed to reset ticket status.');
    }
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode('qr-reader-region');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            await stopCamera();
            await validateAndCheckIn(decodedText);
          },
          () => {}
        );
      }, 150);
    } catch (err) {
      console.error(err);
      setCameraActive(false);
      alert('Could not access camera. You can also upload a QR image or use the Guest Check-In list below.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (e) {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const handleScanImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tempScanner = new Html5Qrcode('qr-file-temp');
      const decodedText = await tempScanner.scanFile(file, false);
      await validateAndCheckIn(decodedText);
    } catch (err) {
      setScanResult({
        success: false,
        message: 'No valid QR code found in the uploaded image.',
      });
    }
  };

  const checkedInCount = tickets.filter((t) => t.status === 'SCANNED').length;

  return (
    <motion.div className="scanner-page glass-card" style={{ maxWidth: '820px', margin: '0 auto' }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="scanner-header">
        <ScanLine size={48} className="scan-icon" />
        <h2>Venue Door Scanner &amp; Guest Check-In</h2>
      </div>
      <p className="scanner-desc">
        Scan a Google Wallet or Ticket QR code with your camera, enter a Short Code (e.g. <code>#9A010813</code>) or UUID, or check in guests directly from the live roster below.
      </p>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {!cameraActive ? (
          <button type="button" onClick={startCamera} className="btn-primary glow-blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} /> Start Camera QR Scanner
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="btn-secondary glow-orange" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CameraOff size={18} /> Stop Camera
          </button>
        )}

        <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.1)' }}>
          Scan QR from Image File
          <input type="file" accept="image/*" onChange={handleScanImageFile} style={{ display: 'none' }} />
        </label>
      </div>

      <div id="qr-file-temp" style={{ display: 'none' }}></div>

      {cameraActive && (
        <div
          id="qr-reader-region"
          style={{
            width: '100%',
            maxWidth: '340px',
            margin: '0 auto 1.2rem auto',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid #00e676',
          }}
        ></div>
      )}

      <form onSubmit={handleScan} className="scan-form">
        <input 
          type="text" 
          value={ticketId}
          onChange={e => setTicketId(e.target.value)}
          placeholder="Enter Short Code (e.g. 9A010813) or Full Ticket UUID..."
          className="scan-input dark-input"
          required
        />
        <button type="submit" className="btn-primary glow-green">Check In Ticket</button>
      </form>

      {scanResult && (
        <motion.div className={`scan-result ${scanResult.success ? 'success' : 'error'}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h3>{scanResult.success ? '✅ AUTHORIZED & CHECKED IN' : '❌ ENTRY DENIED'}</h3>
          <p>{scanResult.message}</p>
          {scanResult.ticket && (
            <p style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '6px' }}>
              Ticket <strong>#{scanResult.ticket.short_code}</strong> • {scanResult.ticket.artist_name} @ {scanResult.ticket.venue_name}
              {scanResult.ticket.buyer_email ? ` • ${scanResult.ticket.buyer_email}` : ''}
            </p>
          )}
        </motion.div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '2rem 0 1.2rem 0' }} />

      <div style={{ textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Live Guest List &amp; Issued Tickets</h3>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,200,83,0.2)', color: '#69f0ae', fontWeight: 600 }}>
              Checked In: {checkedInCount}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)' }}>
              Total Issued: {tickets.length}
            </span>
          </div>
        </div>

        {tickets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No tickets issued yet. Mint a ticket in the Ticket Studio or Fan Landing Page.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {tickets.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: t.status === 'SCANNED' ? 'rgba(0,200,83,0.12)' : 'rgba(255,255,255,0.06)',
                  border: t.status === 'SCANNED' ? '1px solid rgba(0,200,83,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    #{t.short_code} — {t.artist_name} <span style={{ fontWeight: 400, opacity: 0.8 }}>({t.event_title})</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                    Venue: {t.venue_name} • Tier: {t.custom_message || 'GA'} • {t.ticket_type}
                    {t.buyer_email ? ` • ${t.buyer_email}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.status === 'SCANNED' ? (
                    <>
                      <span style={{ color: '#00e676', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={16} /> Checked In
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResetTicket(t.id)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'transparent',
                          color: '#fff',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <RotateCcw size={13} /> Reset
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => validateAndCheckIn(t.id)}
                      className="btn-primary glow-green"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      Check In Guest
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ScannerPage;
