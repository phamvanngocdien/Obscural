import { useState, useEffect, useRef } from 'react';
import { toast } from '../components/common';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api, { contactsApi, profilesApi } from '../services/api';
import '../styles/Contact.css';

export default function Contact() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize contacts and profile state (fetched exclusively from Supabase)
  const [contacts, setContacts] = useState([]);
  const [profile, setProfile] = useState({
    name: user?.name || (user?.email ? user.email.split('@')[0] : ''),
    email: user?.email || '',
    location: '',
    avatarUrl: '',
    company: '',
  });

  // Edit profile form state
  const [editForm, setEditForm] = useState(profile);

  // New contact form state
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    walletAddress: '',
    homeAddress: '',
  });

  // Load profile and contacts directly from Supabase for this user account
  useEffect(() => {
    if (!user?.address) return;
    let isMounted = true;

    const loadUserData = async () => {
      try {
        // 1. Fetch user profile from Supabase
        try {
          const profileRes = await profilesApi.get(user.address);
          if (isMounted && profileRes.exists && profileRes.data) {
            const bp = profileRes.data;
            const updated = {
              name: bp.name || user?.name || (user?.email ? user.email.split('@')[0] : ''),
              email: bp.email || user?.email || '',
              location: bp.location || '',
              avatarUrl: bp.avatar_url || '',
              company: bp.company || '',
            };
            setProfile(updated);
            setEditForm(updated);
          }
        } catch (e) {
          console.warn('Failed to fetch profile from Supabase:', e);
        }

        // 2. Fetch contacts from Supabase
        const currentList = [];
        const seenWallets = new Set();
        const seenEmails = new Set();

        const userAddrLower = user?.address?.toLowerCase().trim();
        const userEmailLower = user?.email?.toLowerCase().trim();
        if (userAddrLower) seenWallets.add(userAddrLower);
        if (userEmailLower) seenEmails.add(userEmailLower);

        try {
          const backendRes = await contactsApi.list(user.address);
          const raw = backendRes.data || [];
          raw.forEach((c) => {
            const w = (c.wallet_address || c.walletAddress || '').toLowerCase().trim();
            const em = (c.email || '').toLowerCase().trim();
            const isDup = (w && seenWallets.has(w)) || (em && seenEmails.has(em));
            if (!isDup) {
              if (w) seenWallets.add(w);
              if (em) seenEmails.add(em);
              currentList.push({
                id: c.id,
                name: c.name || '',
                email: c.email || '',
                walletAddress: c.wallet_address || '',
                address: c.home_address || c.wallet_address || '',
                homeAddress: c.home_address || '',
                company: c.company || '',
                notes: c.notes || '',
                avatarUrl: c.avatar_url || '',
              });
            }
          });
        } catch (e) {
          console.warn('Failed to fetch contacts from Supabase:', e);
        }

        // 3. Extract counterparties from invoice history on Supabase (only if not already in contacts)
        try {
          const res = await api.invoiceApi.list({
            userId: user.address || '',
            email: user.email || '',
          });
          (res.data || []).forEach((inv) => {
            const isRecipient = Boolean(
              (userAddrLower && (inv.recipient_id?.toLowerCase() === userAddrLower || inv.to_data?.walletAddress?.toLowerCase() === userAddrLower)) ||
              (userEmailLower && inv.to_data?.email?.toLowerCase() === userEmailLower)
            );
            const toObj = inv.to_data || inv.to || {};
            const fromObj = inv.from_data || inv.from || {};
            const otherParty = isRecipient ? (inv.creator_id || fromObj.walletAddress) : (inv.recipient_id || toObj.walletAddress);
            const otherWallet = (otherParty || (isRecipient ? fromObj.walletAddress : toObj.walletAddress) || '').toLowerCase().trim();
            const otherEmail = ((isRecipient ? fromObj.email : toObj.email) || '').toLowerCase().trim();

            const isDupWallet = Boolean(otherWallet && seenWallets.has(otherWallet));
            const isDupEmail = Boolean(otherEmail && seenEmails.has(otherEmail));

            if (!isDupWallet && !isDupEmail && (otherWallet || otherEmail)) {
              if (otherWallet) seenWallets.add(otherWallet);
              if (otherEmail) seenEmails.add(otherEmail);
              const otherName = isRecipient ? (fromObj.name || (otherParty ? otherParty.slice(0, 8) : 'Partner')) : (toObj.name || (otherParty ? otherParty.slice(0, 8) : 'Client'));
              currentList.push({
                id: `inv-${otherWallet || otherEmail}`,
                name: otherName,
                email: (isRecipient ? fromObj.email : toObj.email) || '',
                address: (isRecipient ? fromObj.address : toObj.address) || '',
                homeAddress: (isRecipient ? fromObj.address : toObj.address) || '',
                walletAddress: otherParty || '',
              });
            }
          });
        } catch (e) {
          console.warn('Failed to fetch counterparties from invoices:', e);
        }

        if (isMounted) {
          setContacts(currentList);
        }
      } catch (err) {
        console.error('Failed to load user data from Supabase:', err);
      }
    };

    loadUserData();
    return () => {
      isMounted = false;
    };
  }, [user?.address]);

  const shortAddr = user?.address
    ? `${user.address.slice(0, 8)}...${user.address.slice(-6)}`
    : '0x...';

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleOpenEditProfile = () => {
    setEditForm(profile);
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    setProfile(editForm);
    setShowEditProfile(false);
    if (!user?.address) {
      toast.error('Please connect your wallet first');
      return;
    }
    try {
      await profilesApi.save(user.address, {
        name: editForm.name,
        email: editForm.email,
        location: editForm.location,
        avatarUrl: editForm.avatarUrl,
        company: editForm.company || '',
      });
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to save profile to Supabase:', err);
      toast.error('Failed to save profile');
    }
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditForm((prev) => ({ ...prev, avatarUrl: event.target?.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNewContact = async (e) => {
    e?.preventDefault();
    const trimmedName = newContact.name.trim();
    if (!trimmedName) {
      toast.error('Please enter contact name');
      return;
    }
    if (!user?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const res = await contactsApi.create({
        userId: user.address,
        name: trimmedName,
        email: newContact.email.trim(),
        walletAddress: newContact.walletAddress.trim(),
        homeAddress: newContact.homeAddress.trim(),
      });

      const savedContact = res.data || {
        id: `contact-${Date.now()}`,
        name: trimmedName,
        email: newContact.email.trim(),
        wallet_address: newContact.walletAddress.trim(),
        home_address: newContact.homeAddress.trim(),
      };

      const newEntry = {
        id: savedContact.id,
        name: savedContact.name || trimmedName,
        email: savedContact.email || newContact.email.trim(),
        walletAddress: savedContact.wallet_address || newContact.walletAddress.trim(),
        homeAddress: savedContact.home_address || newContact.homeAddress.trim(),
        address: savedContact.home_address || newContact.homeAddress.trim() || savedContact.wallet_address || '',
        company: savedContact.company || '',
        notes: savedContact.notes || '',
        avatarUrl: savedContact.avatar_url || '',
      };

      setContacts((prev) => [newEntry, ...prev]);
      setNewContact({ name: '', email: '', walletAddress: '', homeAddress: '' });
      setShowAddForm(false);
      toast.success(`Contact "${trimmedName}" saved successfully!`);
    } catch (err) {
      console.error('Failed to save contact to Supabase:', err);
      toast.error('Failed to save contact');
    }
  };

  const handleDeleteContact = async (id, name) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.info(`Deleted contact ${name || ''}`);
    if (user?.address && id && !id.startsWith('inv-')) {
      try {
        await contactsApi.delete(id);
      } catch (err) {
        console.error('Failed to delete contact from Supabase:', err);
      }
    }
  };

  const avatarPresets = [
    'linear-gradient(135deg, #8B7AFF 0%, #6366F1 100%)',
    'linear-gradient(135deg, #5DE4C7 0%, #10B981 100%)',
    'linear-gradient(135deg, #FFD641 0%, #F59E0B 100%)',
    'linear-gradient(135deg, #38BDF8 0%, #3B82F6 100%)',
  ];

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.homeAddress || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="contact-page">
      {/* ── User Profile Card ── */}
      <div className="contact-profile-card">
        <div className="contact-profile-top">
          <div
            className="contact-profile-avatar-wrap"
            onClick={handleOpenEditProfile}
            title="Click to edit profile & avatar"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="contact-profile-avatar-img" />
            ) : (
              <div className="contact-profile-avatar">
                <span>{(profile.name || user?.name || user?.address || 'U').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="avatar-edit-overlay">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
          </div>

          <div className="contact-profile-name-group">
            <div className="contact-profile-title-row">
              <span className="contact-profile-name">
                {profile.name || user?.name || shortAddr}
              </span>
              <span className="contact-profile-badge">PROFILE</span>
            </div>
          </div>

          <button className="contact-edit-profile-btn" onClick={handleOpenEditProfile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {locale === 'vi' ? 'Sửa hồ sơ' : 'Edit Profile'}
          </button>
        </div>

        <div className="contact-profile-details">
          <div className="contact-profile-row">
            <span className="contact-profile-label">EMAIL:</span>
            <div className="contact-profile-value-group">
              <span className="contact-profile-value">{user?.email || profile.email || (locale === 'vi' ? 'Chưa thiết lập' : 'Not set')}</span>
              {(user?.email || profile.email) && (
                <button
                  type="button"
                  className={`contact-copy-btn ${copied === 'email' ? 'copied' : ''}`}
                  onClick={() => handleCopy(user?.email || profile.email, 'email')}
                  title={locale === 'vi' ? 'Sao chép Email' : 'Copy Email'}
                  aria-label="Copy Email"
                >
                  {copied === 'email' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="contact-profile-row">
            <span className="contact-profile-label">WALLET:</span>
            <div className="contact-profile-value-group">
              <span className="contact-profile-value">{shortAddr}</span>
              {user?.address && (
                <button
                  type="button"
                  className={`contact-copy-btn ${copied === 'address' ? 'copied' : ''}`}
                  onClick={() => handleCopy(user.address, 'address')}
                  title={locale === 'vi' ? 'Sao chép Địa chỉ ví' : 'Copy Wallet Address'}
                  aria-label="Copy Wallet Address"
                >
                  {copied === 'address' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Physical Address — only displayed if user has explicitly added one */}
          {Boolean(profile.location && profile.location.trim()) && (
            <div className="contact-profile-row">
              <span className="contact-profile-label">{locale === 'vi' ? 'ĐỊA CHỈ:' : 'ADDRESS:'}</span>
              <div className="contact-profile-value-group">
                <span className="contact-profile-value">{profile.location}</span>
                <button
                  type="button"
                  className={`contact-copy-btn ${copied === 'location' ? 'copied' : ''}`}
                  onClick={() => handleCopy(profile.location, 'location')}
                  title={locale === 'vi' ? 'Sao chép Địa chỉ' : 'Copy Address'}
                  aria-label="Copy Address"
                >
                  {copied === 'location' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Search Bar & Add Contact ── */}
      <div className="contact-search-row">
        <div className="contact-search-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={locale === 'vi' ? 'Tìm theo tên, email, địa chỉ hoặc ví...' : 'Search by name, email, address or wallet...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="contact-add-btn" onClick={() => setShowAddForm(true)} title={locale === 'vi' ? 'Thêm liên hệ mới' : 'Add New Contact'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '4px' }}>{locale === 'vi' ? 'Thêm liên hệ' : 'Add Contact'}</span>
        </button>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div className="contact-modal-overlay" onClick={() => setShowEditProfile(false)}>
          <div className="contact-modal edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-header">
              <div className="modal-title-wrap">
                <span className="modal-eyebrow">IDENTITY SETTINGS</span>
                <h3 className="contact-modal-title">Edit Profile</h3>
              </div>
              <button className="contact-modal-close" onClick={() => setShowEditProfile(false)}>✕</button>
            </div>

            <div className="contact-modal-body">
              {/* Avatar Editor Section */}
              <div className="avatar-picker-section">
                <div className="avatar-preview-box">
                  {editForm.avatarUrl ? (
                    <img src={editForm.avatarUrl} alt="Preview" className="avatar-preview-img" />
                  ) : (
                    <div className="contact-profile-avatar" style={{ background: editForm.avatarGradient || 'var(--color-primary-subtle)' }}>
                      <span>{(editForm.name || 'U').charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="avatar-picker-info">
                  <div className="avatar-picker-actions">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleAvatarFileChange}
                    />
                    <button
                      type="button"
                      className="btn-upload-avatar"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload Image
                    </button>
                    {editForm.avatarUrl && (
                      <button
                        type="button"
                        className="btn-remove-avatar"
                        onClick={() => setEditForm((p) => ({ ...p, avatarUrl: '' }))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {avatarPresets.map((preset, i) => (
                      <div
                        key={i}
                        onClick={() => setEditForm((p) => ({ ...p, avatarGradient: preset, avatarUrl: '' }))}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: preset,
                          cursor: 'pointer',
                          border: editForm.avatarGradient === preset ? '2px solid #FFFFFF' : '1px solid rgba(255,255,255,0.2)',
                        }}
                        title={`Preset ${i + 1}`}
                      />
                    ))}
                  </div>
                  <span className="avatar-picker-hint">PNG, JPG or WebP (Max 2MB)</span>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="contact-modal-field">
                <label>Display Name</label>
                <input
                  type="text"
                  placeholder="Enter your name or business name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="contact-modal-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="contact-modal-field">
                <label>{locale === 'vi' ? 'Địa chỉ (Đường, Thành phố, Quốc gia)' : 'Address (Street, City, Country)'}</label>
                <input
                  type="text"
                  placeholder={locale === 'vi' ? 'VD: Số 123 Đường Nguyễn Huệ, TP.HCM' : 'e.g. 123 Tech Blvd, Suite 400, San Francisco, CA'}
                  value={editForm.location}
                  onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="contact-modal-footer">
              <button className="contact-modal-save" onClick={handleSaveProfile}>
                Save Changes
              </button>
              <button className="contact-modal-cancel" onClick={() => setShowEditProfile(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Contact Modal ── */}
      {showAddForm && (
        <div className="contact-modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="contact-modal-header">
              <h3 className="contact-modal-title">Add New Contact</h3>
              <button className="contact-modal-close" onClick={() => setShowAddForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveNewContact}>
              <div className="contact-modal-body">
                <div className="contact-modal-field">
                  <label>Full Name / Business Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe, Acme Corp"
                    value={newContact.name}
                    onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="contact-modal-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. john@acme.com"
                    value={newContact.email}
                    onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
                <div className="contact-modal-field">
                  <label>Address (Street, City, Country)</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Wall St, Suite 500, New York, NY 10005"
                    value={newContact.homeAddress}
                    onChange={(e) => setNewContact((c) => ({ ...c, homeAddress: e.target.value }))}
                  />
                </div>
                <div className="contact-modal-field">
                  <label>Wallet Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newContact.walletAddress}
                    onChange={(e) => setNewContact((c) => ({ ...c, walletAddress: e.target.value }))}
                  />
                </div>

              </div>
              <div className="contact-modal-footer">
                <button type="submit" className="contact-modal-save">
                  Save Contact
                </button>
                <button
                  type="button"
                  className="contact-modal-cancel"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewContact({ name: '', email: '', walletAddress: '', homeAddress: '' });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Contacts List / Empty State ── */}
      {contacts.length === 0 ? (
        <div className="contact-empty-state">
          <div className="contact-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h4 className="contact-empty-title">{locale === 'vi' ? 'Chưa có liên hệ nào' : 'No contacts yet'}</h4>
          <p className="contact-empty-desc">
            {locale === 'vi'
              ? 'Thêm liên hệ đầu tiên để tự động điền địa chỉ khi tạo hóa đơn và thanh toán.'
              : 'Add your first contact to automatically autofill addresses in invoices and settlements.'}
          </p>
          <button type="button" className="contact-empty-add-btn" onClick={() => setShowAddForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {locale === 'vi' ? 'Thêm liên hệ mới' : 'Add New Contact'}
          </button>
        </div>
      ) : (
        /* Unified Contacts List */
        <div className="contact-section">
          <h3 className="contact-section-title">
            {search
              ? (locale === 'vi' ? `Kết quả tìm kiếm (${filtered.length})` : `Search Results (${filtered.length})`)
              : (locale === 'vi' ? `Tất cả liên hệ (${filtered.length})` : `All Contacts (${filtered.length})`)}
          </h3>
          <div className="contact-list">
            {filtered.length === 0 ? (
              <div className="contact-empty">
                {locale === 'vi'
                  ? `Không tìm thấy liên hệ nào khớp với "${search}"`
                  : `No contacts found matching "${search}"`}
              </div>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="contact-item">
                  <div className="contact-item-left">
                    <div className="contact-item-avatar">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-item-info">
                      <span className="contact-item-name">{c.name}</span>
                      <span className="contact-item-email">{c.email || (locale === 'vi' ? 'Chưa có email' : 'No email')}</span>
                      {(c.homeAddress || c.address) && (
                        <span style={{ fontSize: '10px', color: 'rgba(160, 160, 200, 0.55)', marginTop: '2px' }}>
                          📍 {c.homeAddress || c.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {c.walletAddress && (
                      <span className="contact-item-addr" title={c.walletAddress}>
                        {c.walletAddress.slice(0, 6)}...{c.walletAddress.slice(-4)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id, c.name)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#FF6B7A',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '4px',
                        opacity: 0.7,
                      }}
                      title={locale === 'vi' ? 'Xóa liên hệ' : 'Delete Contact'}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
