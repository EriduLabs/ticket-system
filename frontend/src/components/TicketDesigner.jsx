import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTicket, setActiveTicket] = useState({
    id: 'preview-uuid-000',
    ticket_type: 'DIGITAL',
    status: 'VALID',
  });
  const [issuedTickets, setIssuedTickets] = useState([]);
  const [testEmail, setTestEmail] = useState('justin@eridulabs.org');
  const [mintStatus, setMintStatus] = useState('');

  useEffect(() => {
    fetchAllocation();
    fetchIssuedTickets();
  }, [allocationId]);

  const toDatetimeLocal = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fetchAllocation = async () => {
    try {
      const res = await axios.get(`/api/allocations/${allocationId}/`);
      setAllocation(res.data);
      setFormData({
        artist_name: res.data.artist_name,
        event_title: res.data.event_title,
        venue_name: res.data.venue_name,
        event_date: toDatetimeLocal(res.data.event_date),
        ticket_goal: res.data.ticket_goal || 50,
        theme_color: res.data.theme_color || '#1a1a1a',
        background_image_url: res.data.background_image_url || '',
        custom_message: res.data.custom_message || 'General Admission',
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchIssuedTickets = async () => {
    try {
      const res = await axios.get(
        `/api/tickets/?allocation_id=${allocationId}`
      );
      setIssuedTickets(res.data);
      if (res.data.length > 0 && activeTicket.id === 'preview-uuid-000') {
        setActiveTicket(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setSaveStatus('Uploading ticket image...');
    try {
      const uploadForm = new FormData();
      uploadForm.append('image', file);
      const res = await axios.post(
        `/api/upload-image/`,
        uploadForm,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const uploadedUrl = res.data.image_url;
      setFormData((prev) => ({ ...prev, background_image_url: uploadedUrl }));
      setSaveStatus('Image uploaded! Click "Save All Changes" to persist.');
    } catch (err) {
      console.error(err);
      setSaveStatus(err.response?.data?.error || 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaveStatus('Saving...');
    try {
      const eventPayload = {
        title: formData.event_title,
        venue_name: formData.venue_name,
        theme_color: formData.theme_color,
        background_image_url: formData.background_image_url,
        custom_message: formData.custom_message,
      };
      if (formData.event_date) {
        eventPayload.date = new Date(formData.event_date).toISOString();
      }
      const artistPayload = {
        name: formData.artist_name,
      };
      const allocPayload = {
        ticket_goal: Number(formData.ticket_goal) || 50,
      };

      await Promise.all([
        axios.patch(`/api/events/${allocation.event}/`, eventPayload),
        axios.patch(`/api/artists/${allocation.artist}/`, artistPayload),
        axios.patch(`/api/allocations/${allocation.id}/`, allocPayload),
      ]);

      await fetchAllocation();
      setSaveStatus('Design & Venue Details Saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('Error saving details.');
    }
  };

  const handleCreateTestTicket = async () => {
    setMintStatus('Saving design & generating real ticket...');
    try {
      await handleSave();
      const res = await axios.post(
        `/api/allocations/${allocation.id}/digital-sale/`,
        { amount: 1, email: testEmail || null }
      );
      const newTicket = res.data.tickets?.[0];
      if (newTicket) {
        setActiveTicket(newTicket);
        await fetchIssuedTickets();
        const sent = res.data.email_status?.sent;
        setMintStatus(
          sent
            ? `Created Ticket #${newTicket.id.substring(0, 8).toUpperCase()} & emailed pass to ${testEmail}!`
            : `Created Ticket #${newTicket.id.substring(0, 8).toUpperCase()}! Use the card on the right to scan for Google Wallet or check in.`
        );
      }
    } catch (err) {
      console.error(err);
      setMintStatus('Failed to create test ticket.');
    }
  };

  const handleSendActiveTicketEmail = async () => {
    if (!activeTicket || activeTicket.id === 'preview-uuid-000') {
      return handleCreateTestTicket();
    }
    setMintStatus(`Sending Ticket #${activeTicket.id.substring(0, 8).toUpperCase()} to ${testEmail || 'justin@eridulabs.org'}...`);
    try {
      const res = await axios.post(
        `/api/tickets/${activeTicket.id}/send-email/`,
        { email: testEmail || 'justin@eridulabs.org' }
      );
      setMintStatus(res.data.message);
    } catch (err) {
      console.error(err);
      setMintStatus(err.response?.data?.message || 'Failed to send ticket email.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return <div className="loading-state">Loading studio...</div>;

  const mockAllocation = {
    ...allocation,
    ...formData,
    event_date: formData.event_date ? new Date(formData.event_date).toISOString() : allocation?.event_date,
  };

  return (
    <motion.div className="designer-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          &larr; Back to Control Center
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to={`/landing/${allocation.artist_slug}`} className="btn-secondary glow-purple" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: '8px' }}>
            Open Fan Landing Page
          </Link>
          <Link to="/scanner" className="btn-primary glow-green" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: '8px' }}>
            Open Door Scanner &amp; Check-In
          </Link>
        </div>
      </div>
      
      <div className="dashboard-header">
        <h2>Ticket Studio &amp; Venue Setup</h2>
        <p>Upload custom ticket artwork, enter venue &amp; show information, mint a real ticket, and test Google Wallet &amp; door check-in.</p>
      </div>
      
      <div className="designer-grid">
        <motion.form className="designer-form glass-card" onSubmit={handleSave} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>1. Venue &amp; Event Details</h3>
          <div className="form-group">
            <label>Artist / Headliner Name</label>
            <input type="text" name="artist_name" value={formData.artist_name || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Event / Show Title</label>
            <input type="text" name="event_title" value={formData.event_title || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Venue Name &amp; Location</label>
            <input type="text" name="venue_name" value={formData.venue_name || ''} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>Show Date &amp; Time</label>
              <input type="datetime-local" name="event_date" value={formData.event_date || ''} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Venue Ticket Goal / Capacity</label>
              <input type="number" name="ticket_goal" min="1" value={formData.ticket_goal || 50} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Ticket Tier / Custom Pass Header</label>
            <input type="text" name="custom_message" value={formData.custom_message || ''} onChange={handleChange} placeholder="General Admission / VIP Access" />
          </div>

          <h3 style={{ marginTop: '1.2rem', marginBottom: '0.8rem' }}>2. Ticket Artwork &amp; Theme</h3>
          <div className="form-group">
            <label>Upload Ticket Image (PNG, JPG, WEBP)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              style={{ padding: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', width: '100%' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>Theme Color</label>
              <input type="color" name="theme_color" value={formData.theme_color || '#1a1a1a'} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Or Paste Image URL</label>
              <input type="url" name="background_image_url" value={formData.background_image_url || ''} onChange={handleChange} placeholder="https://..." />
            </div>
          </div>

          <button type="submit" className="btn-primary glow-blue" style={{ width: '100%', marginTop: '8px' }}>
            Save All Venue &amp; Design Changes
          </button>
          {saveStatus && <p className="status-msg" style={{ marginTop: '8px' }}>{saveStatus}</p>}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '1.5rem 0' }} />

          <h3 style={{ marginTop: 0, marginBottom: '0.6rem' }}>3. Issue Real Ticket to Test Google Wallet &amp; Check-In</h3>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '10px' }}>
            Mint a real ticket in the database so you can scan its Google Wallet QR code onto your phone and test checking it in at the venue door.
          </p>
          <div className="form-group">
            <label>Fan Email (optional)</label>
            <input
              type="email"
              placeholder="fan@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCreateTestTicket}
              className="btn-primary glow-purple"
              style={{ flex: 1 }}
            >
              + Mint &amp; Email New Ticket
            </button>
            <button
              type="button"
              onClick={handleSendActiveTicketEmail}
              className="btn-primary glow-green"
              style={{ flex: 1 }}
            >
              ✉ Resend Active Ticket to Email
            </button>
          </div>
          {mintStatus && <p className="status-msg" style={{ marginTop: '8px', color: '#80d8ff' }}>{mintStatus}</p>}
        </motion.form>

        <motion.div className="designer-preview glass-card" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h3>
            {activeTicket.id === 'preview-uuid-000'
              ? 'Live Mobile Preview'
              : `Active Ticket #${activeTicket.id.substring(0, 8).toUpperCase()}`}
          </h3>
          <TicketCard
            ticket={activeTicket}
            allocation={mockAllocation}
            onTicketUpdated={(updated) => {
              setActiveTicket(updated);
              fetchIssuedTickets();
            }}
          />

          {issuedTickets.length > 0 && (
            <div style={{ width: '100%', marginTop: '1.5rem', textAlign: 'left' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                Issued Tickets for This Show ({issuedTickets.length})
              </h4>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {issuedTickets.map((t) => {
                  const code = t.id.substring(0, 8).toUpperCase();
                  const isSelected = activeTicket?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTicket(t)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(66,133,244,0.25)' : 'rgba(255,255,255,0.06)',
                        border: isSelected ? '1px solid #4285F4' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <strong>#{code}</strong> ({t.ticket_type})
                        {t.buyer_email ? ` • ${t.buyer_email}` : ''}
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: t.status === 'SCANNED' ? '#00c853' : 'rgba(255,255,255,0.18)',
                          color: '#fff',
                        }}
                      >
                        {t.status === 'SCANNED' ? '✓ Checked In' : 'Valid'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TicketDesigner;
