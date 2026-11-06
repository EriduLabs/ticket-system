import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import TicketCard from './TicketCard';

const ArtistPage = () => {
  const { slug } = useParams();
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [ticketCount, setTicketCount] = useState(1);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetchAllocation();
  }, [slug]);

  const fetchAllocation = async () => {
    try {
      const res = await axios.get(`/api/landing/${slug}/`);
      setAllocation(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleBuyTicket = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = buyerEmail.trim();
    setPurchaseStatus(
      cleanEmail
        ? `Creating ticket(s) & sending Google Wallet pass to ${cleanEmail}...`
        : 'Processing encrypted payment...'
    );
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const response = await axios.post(
        `/api/allocations/${allocation.id}/digital-sale/`,
        { amount: Number(ticketCount) || 1, email: cleanEmail || null }
      );
      const emailSent = response.data.email_status?.sent;
      setPurchaseStatus(
        emailSent
          ? `✅ Success! Your ticket pass was emailed to ${cleanEmail} and is ready below.`
          : '✅ Success! Your eWallet pass is ready below.'
      );
      setTickets(response.data.tickets);
      fetchAllocation();
    } catch (err) {
      setPurchaseStatus('Payment failed.');
    }
  };

  if (loading) return <div className="loading-state">Loading...</div>;
  if (!allocation) return <div className="loading-state">Artist landing page not found.</div>;

  return (
    <motion.div className="landing-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <motion.div className="landing-hero" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), ${allocation.theme_color || '#111'}), url(${allocation.background_image_url})` }} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="hero-content">
          <h1>{allocation.artist_name}</h1>
          <h2>Live at {allocation.event_title}</h2>
        </div>
      </motion.div>
      
      <div className="landing-content">
        <motion.form onSubmit={handleBuyTicket} className="ticket-box glass-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3>{allocation.custom_message || 'General Admission'}</h3>
          <p className="price-tag">$20.00</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Enter email to receive your ticket..."
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              style={{
                flex: 1,
                minWidth: '220px',
                maxWidth: '280px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
            <input
              type="number"
              min="1"
              max="10"
              value={ticketCount}
              onChange={(e) => setTicketCount(e.target.value)}
              title="Number of tickets"
              style={{
                width: '68px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '0.9rem',
                textAlign: 'center',
              }}
            />
          </div>
          <button type="submit" className="btn-buy glow-pink">
            Purchase &amp; Email Digital Ticket
          </button>
          {purchaseStatus && <p className="status-msg">{purchaseStatus}</p>}
        </motion.form>

        <AnimatePresence>
          {tickets.length > 0 && (
            <motion.div className="purchased-tickets" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.5 }}>
              <h3>Your Tickets</h3>
              <p>Save this to your phone!</p>
              <div className="tickets-stack">
                {tickets.map((ticket, index) => (
                  <motion.div key={ticket.id} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.2 }}>
                    <TicketCard ticket={ticket} allocation={allocation} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ArtistPage;
