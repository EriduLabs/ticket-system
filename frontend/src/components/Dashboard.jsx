import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Ticket, PenTool, PlusCircle } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newEvent, setNewEvent] = useState({
    artist_name: '',
    event_title: '',
    venue_name: '',
    event_date: '',
    ticket_goal: 100,
    custom_message: 'General Admission',
    theme_color: '#1a1a1a',
    background_image_url: '',
    recipient_email: '',
    ticket_amount: 1,
  });

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get(`/api/allocations/`);
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
        await axios.post(`/api/allocations/${id}/cash-sale/`, { 
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

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newEvent,
        event_date: newEvent.event_date ? new Date(newEvent.event_date).toISOString() : null,
      };
      const res = await axios.post(
        `/api/allocations/create-event/`,
        payload
      );
      if (res.data.email_status?.sent) {
        alert(`Event created and ticket pass emailed to ${newEvent.recipient_email}!`);
      }
      setShowCreateForm(false);
      await fetchAllocations();
      navigate(`/design/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create event.');
    }
  };

  const handleNewEventImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await axios.post(
        `/api/upload-image/`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setNewEvent((prev) => ({ ...prev, background_image_url: res.data.image_url }));
    } catch (err) {
      alert('Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) return <div className="loading-state">Loading Dashboard...</div>;

  return (
    <motion.div className="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2><LayoutDashboard style={{marginRight:'10px'}}/> Venue / Artist Control Center</h2>
          <p>Manage allocations, upload ticket artwork, and track live event sales &amp; door check-ins.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="btn-primary glow-purple"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <PlusCircle size={18} />
          {showCreateForm ? 'Close Form' : 'New Show / Venue Ticket'}
        </button>
      </div>

      {showCreateForm && (
        <motion.form
          onSubmit={handleCreateEvent}
          className="glass-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem', padding: '1.5rem' }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Create New Event &amp; Ticket Pass</h3>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label>Artist / Headliner</label>
              <input
                type="text"
                required
                placeholder="e.g. Electric Horizon"
                value={newEvent.artist_name}
                onChange={(e) => setNewEvent({ ...newEvent, artist_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Event / Show Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Summer Bass Tour"
                value={newEvent.event_title}
                onChange={(e) => setNewEvent({ ...newEvent, event_title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Venue Name</label>
              <input
                type="text"
                required
                placeholder="e.g. The Echo Lounge, Atlanta"
                value={newEvent.venue_name}
                onChange={(e) => setNewEvent({ ...newEvent, venue_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Show Date &amp; Time</label>
              <input
                type="datetime-local"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Ticket Tier / Header</label>
              <input
                type="text"
                value={newEvent.custom_message}
                onChange={(e) => setNewEvent({ ...newEvent, custom_message: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Ticket Goal / Capacity</label>
              <input
                type="number"
                min="1"
                value={newEvent.ticket_goal}
                onChange={(e) => setNewEvent({ ...newEvent, ticket_goal: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Upload Ticket Banner Image</label>
              <input type="file" accept="image/*" onChange={handleNewEventImageUpload} disabled={uploadingImage} />
            </div>
            <div className="form-group">
              <label>Theme Color</label>
              <input
                type="color"
                value={newEvent.theme_color}
                onChange={(e) => setNewEvent({ ...newEvent, theme_color: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email to Receive First Ticket (optional)</label>
              <input
                type="email"
                placeholder="fan@example.com"
                value={newEvent.recipient_email}
                onChange={(e) => setNewEvent({ ...newEvent, recipient_email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tickets to Email Now</label>
              <input
                type="number"
                min="1"
                max="20"
                value={newEvent.ticket_amount}
                onChange={(e) => setNewEvent({ ...newEvent, ticket_amount: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary glow-blue" style={{ marginTop: '12px' }}>
            {newEvent.recipient_email
              ? 'Create Show, Email Ticket Pass & Open Studio →'
              : 'Create Show & Open Ticket Studio →'}
          </button>
        </motion.form>
      )}
      
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
