import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';

const TicketCard = ({ ticket, allocation, onTicketUpdated }) => {
  const [walletData, setWalletData] = useState(null);
  const [qrMode, setQrMode] = useState('entry'); // 'entry' | 'wallet-wifi' | 'wallet-direct'
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [ticketStatus, setTicketStatus] = useState(ticket?.status || 'VALID');
  const [checkingIn, setCheckingIn] = useState(false);

  React.useEffect(() => {
    setTicketStatus(ticket?.status || 'VALID');
    setWalletData(null);
  }, [ticket?.id, ticket?.status]);

  const bgImage = allocation.background_image_url || 'https://images.unsplash.com/photo-1540039155733-d7fbc999e347?auto=format&fit=crop&q=80&w=1000';
  const themeColor = allocation.theme_color || '#1a1a1a';
  
  // Safe date parsing
  let eventDate = 'TBD';
  let eventTime = 'TBD';
  if (allocation.event_date) {
    const dateObj = new Date(allocation.event_date);
    eventDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    eventTime = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const ticketId = ticket?.id || '00000000-0000-0000-0000-000000000000';
  const shortId = ticketId.substring(0, 8).toUpperCase();
  const isPreviewTicket = ticketId.startsWith('preview-') || ticketId.startsWith('00000000');

  const handleToggleCheckIn = async () => {
    if (isPreviewTicket) return;
    setCheckingIn(true);
    try {
      if (ticketStatus === 'VALID') {
        const res = await axios.post(
          `/api/tickets/${ticketId}/scan/`
        );
        setTicketStatus(res.data.ticket?.status || 'SCANNED');
        if (onTicketUpdated) onTicketUpdated(res.data.ticket);
      } else {
        const res = await axios.post(
          `/api/tickets/${ticketId}/status/`,
          { status: 'VALID' }
        );
        setTicketStatus(res.data.ticket?.status || 'VALID');
        if (onTicketUpdated) onTicketUpdated(res.data.ticket);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update check-in status.');
    } finally {
      setCheckingIn(false);
    }
  };

  const fetchGoogleWalletPass = async () => {
    if (walletData) return walletData;
    setLoadingWallet(true);
    try {
      const params = allocation?.id ? { allocation_id: allocation.id } : {};
      const res = await axios.get(
        `/api/tickets/${ticketId}/google-wallet/`,
        { params }
      );
      setWalletData(res.data);
      return res.data;
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleWalletClick = async (walletName) => {
    if (walletName === 'Apple Wallet') {
      // Simulate downloading a .pkpass file
      const element = document.createElement("a");
      const file = new Blob(["This is a mock Apple Wallet .pkpass file payload. In production, this requires an Apple Developer Certificate to sign."], {type: 'application/vnd.apple.pkpass'});
      element.href = URL.createObjectURL(file);
      element.download = `${allocation.event_title.replace(/\s+/g, '_')}_Ticket.pkpass`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (walletName === 'Google Wallet') {
      try {
        const data = await fetchGoogleWalletPass();
        setQrMode('wallet-wifi');
        window.open(data.save_url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error(err);
        const detail = err.response?.data?.error || 'Failed to generate Google Wallet pass.';
        alert(detail);
      }
    } else if (walletName === 'Google Wallet QR') {
      try {
        await fetchGoogleWalletPass();
        setQrMode(prev => (prev === 'entry' ? 'wallet-wifi' : 'entry'));
      } catch (err) {
        console.error(err);
        alert('Failed to generate Google Wallet QR code.');
      }
    } else if (walletName === 'Samsung Wallet') {
      // Simulate redirecting to Samsung Wallet API
      window.open(`https://api.wallet.samsung.com/v1/mock-pass/${ticketId}`, '_blank');
    }
  };

  const activeQrValue =
    qrMode === 'wallet-wifi' && walletData
      ? walletData.qr_url
      : qrMode === 'wallet-direct' && walletData
      ? walletData.save_url
      : ticketId;

  return (
    <div className="ewallet-pass">
      <div className="ewallet-header" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="ewallet-overlay" style={{ background: `linear-gradient(to bottom, transparent 0%, ${themeColor} 100%)` }}></div>
        
        {/* Ticket Logos */}
        <div className="ewallet-logos">
          <img src="/tms-logo.png" alt="TMS" className="ewallet-logo tms" onError={(e) => e.target.style.display='none'} />
          <img src="/elabs-logo.png" alt="Elabs" className="ewallet-logo elabs" onError={(e) => e.target.style.display='none'} />
        </div>

        <div className="ewallet-header-content">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span className="ewallet-category">{allocation.custom_message || 'General Admission'}</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '12px',
                background: ticketStatus === 'SCANNED' ? '#00c853' : '#ff2a85',
                color: '#fff',
                letterSpacing: '0.5px',
              }}
            >
              {ticketStatus === 'SCANNED' ? '✓ CHECKED IN' : isPreviewTicket ? 'PREVIEW PASS' : 'VALID PASS'}
            </span>
          </div>
          <h1 className="ewallet-artist">{allocation.artist_name}</h1>
          <h2 className="ewallet-event">{allocation.event_title}</h2>
        </div>
      </div>
      
      <div className="ewallet-body" style={{ backgroundColor: themeColor }}>
        <div className="ewallet-row">
          <div className="ewallet-col">
            <span className="ewallet-label">Date</span>
            <span className="ewallet-val">{eventDate}</span>
          </div>
          <div className="ewallet-col text-right">
            <span className="ewallet-label">Time</span>
            <span className="ewallet-val">{eventTime}</span>
          </div>
        </div>
        
        <div className="ewallet-row">
          <div className="ewallet-col">
            <span className="ewallet-label">Venue</span>
            <span className="ewallet-val">{allocation.venue_name}</span>
          </div>
          <div className="ewallet-col text-right">
            <span className="ewallet-label">Section / Seat</span>
            <span className="ewallet-val">GA</span>
          </div>
        </div>

        <div className="ewallet-divider"></div>

        <div className="ewallet-qr-section">
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setQrMode('entry')}
              style={{
                fontSize: '0.72rem',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: qrMode === 'entry' ? '#fff' : 'rgba(255,255,255,0.1)',
                color: qrMode === 'entry' ? '#000' : '#fff',
                cursor: 'pointer',
              }}
            >
              Door Entry QR
            </button>
            <button
              type="button"
              onClick={() => handleWalletClick('Google Wallet QR')}
              style={{
                fontSize: '0.72rem',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: qrMode !== 'entry' ? '#4285F4' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {loadingWallet ? 'Loading...' : 'Scan for Google Wallet'}
            </button>
          </div>

          <div className="ewallet-qr-bg">
            <QRCode
              value={activeQrValue}
              size={qrMode === 'wallet-direct' ? 210 : 165}
              level={qrMode === 'entry' ? 'H' : 'L'}
            />
          </div>

          {qrMode === 'entry' ? (
            <div style={{ textAlign: 'center' }}>
              <p className="ewallet-ticket-id">#{shortId}</p>
              {!isPreviewTicket && (
                <button
                  type="button"
                  onClick={handleToggleCheckIn}
                  disabled={checkingIn}
                  style={{
                    marginTop: '6px',
                    fontSize: '0.72rem',
                    padding: '5px 12px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: ticketStatus === 'SCANNED' ? 'rgba(255,255,255,0.15)' : '#00c853',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {checkingIn
                    ? 'Updating...'
                    : ticketStatus === 'SCANNED'
                    ? 'Checked In ✓ (Click to Reset)'
                    : 'Check In / Mark Scanned'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', opacity: 0.9, margin: '4px 0' }}>
                {qrMode === 'wallet-wifi'
                  ? 'Scan with phone camera (same Wi-Fi) to add to Google Wallet'
                  : 'Scan direct Google Wallet URL'}
              </p>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setQrMode(qrMode === 'wallet-wifi' ? 'wallet-direct' : 'wallet-wifi')}
                  style={{
                    fontSize: '0.68rem',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {qrMode === 'wallet-wifi' ? 'Switch to Direct URL QR' : 'Switch to Fast Wi-Fi QR'}
                </button>
              </div>
              {walletData?.wallet_api_status === 'permission_denied' && (
                <p style={{ fontSize: '0.68rem', color: '#ffcc80', marginTop: '6px', lineHeight: 1.3 }}>
                  Note: Invite <code>this-is-music-tickets@eridu-qagentic.iam.gserviceaccount.com</code> in Google Pay &amp; Wallet Console &rarr; Users so Google allows saving.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ewallet-footer">
        <button className="wallet-btn apple" onClick={() => handleWalletClick('Apple Wallet')}>
          Add to Apple Wallet
        </button>
        <button className="wallet-btn google" onClick={() => handleWalletClick('Google Wallet')}>
          Add to Google Wallet
        </button>
        <button className="wallet-btn samsung" onClick={() => handleWalletClick('Samsung Wallet')}>
          Add to Samsung Wallet
        </button>
      </div>
    </div>
  );
};

export default TicketCard;
