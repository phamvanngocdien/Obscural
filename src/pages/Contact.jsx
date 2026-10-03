import { useState, useEffect, useRef } from 'react';
import { toast } from '../components/common';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api, { contactsApi, profilesApi } from '../services/api';
import '../styles/Contact.css';

const DEFAULT_DEMO_CONTACTS = [
  {
    id: 'demo-1',
    name: 'Satoshi Nakamoto',
    email: 'satoshi@nakamoto.org',
    address: 'Block #0 Genesis St, Cypherpunk City, Metaverse',
    homeAddress: 'Block #0 Genesis St, Cypherpunk City, Metaverse',
  },
  {
    id: 'demo-2',
    name: 'Vitalik Buterin',
    email: 'vitalik@ethereum.org',
    address: 'Zug Crypto Valley, Switzerland',
    homeAddress: 'Zug Crypto Valley, Switzerland',
  },
  {
    id: 'demo-3',
    name: 'Rialo Core Labs',
    email: 'team@rialo.network',
    address: '742 Evergreen Terrace, Silicon Valley, CA 94025',
    homeAddress: '742 Evergreen Terrace, Silicon Valley, CA 94025',
  },
];

export default function Contact() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize contacts from localStorage immediately
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('obscural_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading local contacts:', e);
    }
    // Default seed
    localStorage.setItem('obscural_contacts', JSON.stringify(DEFAULT_DEMO_CONTACTS));
    return DEFAULT_DEMO_CONTACTS;
  });

  // User profile state stored in localStorage
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('obscural_profile');
    return saved
      ? JSON.parse(saved)
      : {
          name: user?.name || (user?.address ? `${user.address.slice(0, 8)}...${user.address.slice(-4)}` : '0xfd32...C101'),
          email: user?.email || 'user@obscural.xyz',
          location: '100 Financial Way, Manhattan, New York, NY 10005',
          avatarUrl: '',
        };
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

  // Sync profile to localStorage + backend
  useEffect(() => {
    localStorage.setItem('obscural_profile', JSON.stringify(profile));
  }, [profile]);

  // Load contacts from backend and merge with localStorage (offline-first)
  useEffect(() => {
    if (!user?.address) return;
    const loadAndSync = async () => {
      try {
        const localSaved = localStorage.getItem('obscural_contacts');
        const currentList = localSaved ? JSON.parse(localSaved) : [];
        const seen = new Set(currentList.map((c) => (c.email || c.name || '').toLowerCase()).filter(Boolean));

        // 1. Fetch contacts from backend
        let backendContacts = [];
        try {
          const backendRes = await contactsApi.list(user.address);
          backendContacts = (backendRes.data || []).map((c) => ({
            id: c.id,
            name: c.name || '',
            email: c.email || '',
            walletAddress: c.wallet_address || '',
            address: c.home_address || '',
            homeAddress: c.home_address || '',
            company: c.company || '',
            notes: c.notes || '',
            avatarUrl: c.avatar_url || '',
          }));
        } catch {
          // Backend unavailable — continue with localStorage
        }

        // 2. Merge backend contacts with local (dedupe by name/email)
        backendContacts.forEach((bc) => {
          const key = (bc.email || bc.name || '').toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            currentList.push(bc);
          }
        });

        // 3. Extract contacts from invoice history
        try {
          const res = await api.invoiceApi.list({ userId: user.address });
          (res.data || []).forEach((inv) => {
            const isRecipient = inv.recipient_id?.toLowerCase() === user?.address?.toLowerCase();
            const otherParty = isRecipient ? inv.creator_id : inv.recipient_id;
            if (otherParty && !seen.has(otherParty.toLowerCase())) {
              seen.add(otherParty.toLowerCase());
              const otherName = (isRecipient ? inv.from?.name : inv.to?.name) || otherParty.slice(0, 8);
              currentList.push({
                id: `api-${otherParty}`,
                name: otherName,
                email: (isRecipient ? inv.from?.email : inv.to?.email) || '',
                address: (isRecipient ? inv.from?.address : inv.to?.address) || '',
                homeAddress: (isRecipient ? inv.from?.address : inv.to?.address) || '',
              });
            }
          });
        } catch {
          // Invoice API unavailable
        }

        setContacts(currentList);
        localStorage.setItem('obscural_contacts', JSON.stringify(currentList));

        // 4. Sync local-only contacts to backend (fire-and-forget)
        const localOnlyContacts = currentList.filter((c) => !c.id?.match?.(/^[0-9a-f-]{36}$/i));
        if (localOnlyContacts.length > 0) {
          contactsApi.sync(user.address, localOnlyContacts).catch(() => {});
        }

        // 5. Load profile from backend
        try {
          const profileRes = await profilesApi.get(user.address);
          if (profileRes.exists && profileRes.data) {
            const bp = profileRes.data;
            setProfile((prev) => {
              const merged = {
                name: bp.name || prev.name,
                email: bp.email || prev.email,
                location: bp.location || prev.location,
                avatarUrl: bp.avatar_url || prev.avatarUrl,
                company: bp.company || '',
              };
              localStorage.setItem('obscural_profile', JSON.stringify(merged));
              return merged;
            });
          }
        } catch {
          // Profile API unavailable
        }
      } catch (err) {
        console.error('Failed to sync contacts:', err);
      }
    };
    loadAndSync();
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

  const handleSaveProfile = () => {
    setProfile(editForm);
    setShowEditProfile(false);
    toast.success('Profile updated successfully');
    // Sync profile to backend
    if (user?.address) {
      profilesApi.save(user.address, {
        name: editForm.name,
        email: editForm.email,
        location: editForm.location,
        avatarUrl: editForm.avatarUrl,
      }).catch(() => {});
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

    const contactToSave = {
      id: `contact-${Date.now()}`,
      name: trimmedName,
      email: newContact.email.trim(),
      walletAddress: newContact.walletAddress.trim(),
      address: newContact.homeAddress.trim() || newContact.walletAddress.trim(),
      homeAddress: newContact.homeAddress.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [contactToSave, ...contacts];
    setContacts(updated);
    localStorage.setItem('obscural_contacts', JSON.stringify(updated));

    setNewContact({ name: '', email: '', walletAddress: '', homeAddress: '' });
    setShowAddForm(false);
    toast.success(`Contact "${trimmedName}" saved successfully!`);

    // Sync to backend
    if (user?.address) {
      try {
        const res = await contactsApi.create({
          userId: user.address,
          name: trimmedName,
          email: newContact.email.trim(),
          walletAddress: newContact.walletAddress.trim(),
          homeAddress: newContact.homeAddress.trim(),
        });
        // Update local ID with backend UUID
        if (res.data?.id) {
          const withBackendId = updated.map((c) =>
            c.id === contactToSave.id ? { ...c, id: res.data.id } : c
          );
          setContacts(withBackendId);
          localStorage.setItem('obscural_contacts', JSON.stringify(withBackendId));
        }
      } catch {
        // Backend unavailable — contact saved locally
      }
    }
  };

  const handleDeleteContact = (id, name) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    localStorage.setItem('obscural_contacts', JSON.stringify(updated));
    toast.info(`Deleted contact ${name || ''}`);
    // Sync deletion to backend (UUID-format IDs are from backend)
    if (id?.match?.(/^[0-9a-f-]{36}$/i)) {
      contactsApi.delete(id).catch(() => {});
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

  const recentContacts = filtered.slice(0, 3);
  const allContacts = filtered;

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
              <span className="contact-profile-value">{profile.email || (locale === 'vi' ? 'Chưa thiết lập' : 'Not set')}</span>
              {profile.email && (
                <button className="contact-copy-btn" onClick={() => handleCopy(profile.email, 'email')} title={locale === 'vi' ? 'Sao chép Email' : 'Copy Email'}>
                  {copied === 'email' ? '✓' : '⧉'}
                </button>
              )}
            </div>
          </div>

          <div className="contact-profile-row">
            <span className="contact-profile-label">WALLET:</span>
            <div className="contact-profile-value-group">
              <span className="contact-profile-value">{shortAddr}</span>
              <button className="contact-copy-btn" onClick={() => handleCopy(user?.address || '', 'address')} title={locale === 'vi' ? 'Sao chép Địa chỉ' : 'Copy Address'}>
                {copied === 'address' ? '✓' : '⧉'}
              </button>
            </div>
          </div>

          <div className="contact-profile-row">
            <span className="contact-profile-label">{locale === 'vi' ? 'ĐỊA CHỈ:' : 'ADDRESS:'}</span>
            <div className="contact-profile-value-group">
              <span className="contact-profile-value">{profile.location || (locale === 'vi' ? 'Chưa thiết lập' : 'Not set')}</span>
              {profile.location && (
                <button className="contact-copy-btn" onClick={() => handleCopy(profile.location, 'location')} title={locale === 'vi' ? 'Sao chép Địa chỉ' : 'Copy Address'}>
                  {copied === 'location' ? '✓' : '⧉'}
                </button>
              )}
            </div>
          </div>
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
                <label>Address (Street, City, Country)</label>
                <input
                  type="text"
                  placeholder="e.g. 100 Financial Way, Manhattan, New York, NY 10005"
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

      {/* ── Recent Contacts ── */}
      <div className="contact-section">
        <h3 className="contact-section-title">{locale === 'vi' ? 'Liên hệ gần đây' : 'Recent Contacts'} ({recentContacts.length})</h3>
        <div className="contact-list">
          {recentContacts.length === 0 ? (
            <div className="contact-empty">{locale === 'vi' ? 'Chưa có liên hệ nào' : 'No contacts yet'}</div>
          ) : (
            recentContacts.map((c) => (
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

      {/* ── All Contacts ── */}
      <div className="contact-section">
        <h3 className="contact-section-title">{locale === 'vi' ? 'Tất cả liên hệ' : 'All Contacts'} ({allContacts.length})</h3>
        <div className="contact-list">
          {allContacts.length === 0 ? (
            <div className="contact-empty">
              {locale === 'vi'
                ? `Không tìm thấy liên hệ nào khớp với "${search}"`
                : `No contacts found matching "${search}"`}
            </div>
          ) : (
            allContacts.map((c) => (
              <div key={`all-${c.id}`} className="contact-item">
                <div className="contact-item-left">
                  <div className="contact-item-avatar">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-item-info">
                    <span className="contact-item-name">{c.name}</span>
                    <span className="contact-item-email">{c.email || 'No email'}</span>
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
                    title="Delete Contact"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
