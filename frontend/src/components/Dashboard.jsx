import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Ticket, PenTool } from 'lucide-react';

const Dashboard = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get(`${window.location.protocol}//${window.location.hostname}:8000/api/allocations/`);
      setAllocations(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCashSale = async (id) => {
    const amount = prompt('How many cash tickets to record?', '1');
    if (amount && !isNaN(amount)) {
      const email = prompt('Enter fan email to send digital receipt & ticket (optional):', '');
      try {
        await axios.post(`${window.location.protocol}//${window.location.hostname}:8000/api/allocations/${id}/cash-sale/`, { 
          amount, 
          email: email || null 
        });
        fetchAllocations();
        if (email) alert(`Success! Logged sale and emailed ticket to ${email}`);
      } catch (err) {
        console.error(err);
        alert('Failed to log sale.');
      }
    }
  };

  if (loading) return <div className="loading-state">Loading Dashboard...</div>;

  return (
    <motion.div className="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="dashboard-header">
        <h2><LayoutDashboard style={{marginRight:'10px'}}/> Venue / Artist Control Center</h2>
        <p>Manage allocations and track live event sales in real-time.</p>
      </div>
      
      <div className="card-container">
        {allocations.map((alloc, index) => (
          <motion.div key={alloc.id} className="card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}>
            <div className="card-header">
              <h3>{alloc.artist_name}</h3>
              <p className="card-venue">{alloc.event_title}</p>
            </div>
            
            <div className="card-stats">
              <div className="stat">
                <span className="stat-label">Goal</span>
                <span className="stat-val">{alloc.ticket_goal}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Sold</span>
                <span className="stat-val">{alloc.total_sold}</span>
              </div>
            </div>
            
            <div className="progress-bar">
              <motion.div className="progress" initial={{ width: 0 }} animate={{ width: `${Math.min((alloc.total_sold / alloc.ticket_goal) * 100, 100)}%` }} transition={{ duration: 1, ease: "easeOut" }}></motion.div>
            </div>

            <div className="actions">
              <button onClick={() => handleCashSale(alloc.id)} className="btn-primary glow-blue">
                <Ticket size={18}/> Log Cash Sale
              </button>
              <Link to={`/design/${alloc.id}`} className="btn-secondary glow-orange">
                <PenTool size={18}/> Edit Design & Info
              </Link>
              <Link to={`/landing/${alloc.artist_slug}`} className="btn-primary glow-purple">
                <Users size={18}/> Fan Landing Page
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default Dashboard;
