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

  const handleBuyTicket = async () => {
    setPurchaseStatus('Processing encrypted payment...');
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const response = await axios.post(
        `/api/allocations/${allocation.id}/digital-sale/`,
        { amount: 1, email: buyerEmail || null }
      );
      const emailSent = response.data.email_status?.sent;
      setPurchaseStatus(
        emailSent
          ? `Success! Pass ready & confirmation emailed to ${buyerEmail}.`
          : 'Success! Your eWallet pass is ready below.'
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
        <motion.div className="ticket-box glass-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3>{allocation.custom_message || 'General Admission'}</h3>
          <p className="price-tag">$20.00</p>
          <div style={{ marginBottom: '12px' }}>
            <input
              type="email"
              placeholder="Enter email for ticket receipt (optional)"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <button onClick={handleBuyTicket} className="btn-buy glow-pink">
            Purchase Digital Ticket
          </button>
          {purchaseStatus && <p className="status-msg">{purchaseStatus}</p>}
        </motion.div>

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
