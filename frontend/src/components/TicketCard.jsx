import React from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';

const TicketCard = ({ ticket, allocation }) => {
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
        // Fetch the REAL Google Wallet JWT from our Django backend
        const res = await axios.get(`${window.location.protocol}//${window.location.hostname}:8000/api/tickets/${ticketId}/google-wallet/`);
        // Open the official Google Pay save URL with our generated JWT payload
        window.open(res.data.save_url, '_blank');
      } catch (err) {
        console.error(err);
        alert('Failed to generate Google Wallet pass.');
      }
    } else if (walletName === 'Samsung Wallet') {
      // Simulate redirecting to Samsung Wallet API
      window.open(`https://api.wallet.samsung.com/v1/mock-pass/${ticketId}`, '_blank');
    }
  };

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
          <span className="ewallet-category">{allocation.custom_message || 'General Admission'}</span>
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
          <div className="ewallet-qr-bg">
            <QRCode value={ticketId} size={150} level="H" />
          </div>
          <p className="ewallet-ticket-id">{shortId}</p>
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
