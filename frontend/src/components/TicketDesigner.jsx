import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import TicketCard from './TicketCard';

const TicketDesigner = () => {
  const { allocationId } = useParams();
  const navigate = useNavigate();
  const [allocation, setAllocation] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetchAllocation();
  }, [allocationId]);

  const fetchAllocation = async () => {
    try {
      const res = await axios.get(`${window.location.protocol}//${window.location.hostname}:8000/api/allocations/${allocationId}/`);
      setAllocation(res.data);
      setFormData({
        artist_name: res.data.artist_name,
        event_title: res.data.event_title,
        venue_name: res.data.venue_name,
        theme_color: res.data.theme_color || '#1a1a1a',
        background_image_url: res.data.background_image_url || '',
        custom_message: res.data.custom_message || 'General Admission',
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveStatus('Saving...');
    try {
      const eventPayload = {
        title: formData.event_title,
        venue_name: formData.venue_name,
        theme_color: formData.theme_color,
        background_image_url: formData.background_image_url,
        custom_message: formData.custom_message,
      };
      const artistPayload = {
        name: formData.artist_name
      };

      await Promise.all([
        axios.patch(`${window.location.protocol}//${window.location.hostname}:8000/api/events/${allocation.event}/`, eventPayload),
        axios.patch(`${window.location.protocol}//${window.location.hostname}:8000/api/artists/${allocation.artist}/`, artistPayload)
      ]);
      
      setSaveStatus('Design & Details Saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('Error saving details.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return <div className="loading-state">Loading studio...</div>;

  const mockAllocation = {
    ...allocation,
    ...formData
  };

  return (
    <motion.div className="designer-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <button className="btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1.5rem' }}>
        &larr; Back to Control Center
      </button>
      
      <div className="dashboard-header">
        <h2>Ticket Studio</h2>
        <p>Edit event details, update artist names, and customize the live ticket design.</p>
      </div>
      
      <div className="designer-grid">
        <motion.form className="designer-form glass-card" onSubmit={handleSave} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <div className="form-group">
            <label>Artist Name</label>
            <input type="text" name="artist_name" value={formData.artist_name || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Event Title</label>
            <input type="text" name="event_title" value={formData.event_title || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Venue Name</label>
            <input type="text" name="venue_name" value={formData.venue_name || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Ticket Type / Custom Message</label>
            <input type="text" name="custom_message" value={formData.custom_message || ''} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>Theme Color</label>
              <input type="color" name="theme_color" value={formData.theme_color || '#1a1a1a'} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Background Image URL</label>
              <input type="url" name="background_image_url" value={formData.background_image_url || ''} onChange={handleChange} placeholder="https://..." />
            </div>
          </div>

          <button type="submit" className="btn-primary glow-blue">Save All Changes</button>
          {saveStatus && <span className="status-msg">{saveStatus}</span>}
        </motion.form>

        <motion.div className="designer-preview glass-card" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h3>Live Mobile Preview</h3>
          <TicketCard ticket={{ id: 'preview-uuid-000', ticket_type: 'DIGITAL', status: 'VALID' }} allocation={mockAllocation} />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TicketDesigner;
