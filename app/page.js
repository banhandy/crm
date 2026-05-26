'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Search, 
  Plus, 
  Sun, 
  Moon, 
  X, 
  ChevronRight, 
  AlertTriangle, 
  Briefcase, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck,
  Building,
  Mail,
  MapPin,
  Calendar,
  UserCheck
} from 'lucide-react';

export default function CRMHome() {
  // Navigation & Theme States
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'inquiries', 'customers'
  const [theme, setTheme] = useState('dark');

  // Database States
  const [inquiries, setInquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [picFilter, setPicFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Active Modals & Selected Drawer State
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddInquiryOpen, setIsAddInquiryOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Form states for new inquiry
  const [newInquiry, setNewInquiry] = useState({
    customer_id: '',
    category: 'standard',
    item_name: '',
    quotation_number: '',
    lead_time_days: '',
    remark: '',
    status: 'Pending Quotation'
  });

  // Form states for new customer
  const [newCustomer, setNewCustomer] = useState({
    company_name: '',
    sector_business: '',
    regional: '',
    address: '',
    email_address: '',
    pic_name: '',
    status_email: 'Active'
  });

  // Fetch all initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch customers
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true });
      if (custErr) throw custErr;
      setCustomers(custData || []);

      // Fetch inquiries with customer info join
      const { data: inqData, error: inqErr } = await supabase
        .from('inquiries')
        .select(`
          *,
          customers (
            company_name,
            pic_name
          )
        `)
        .order('created_at', { ascending: false });
      if (inqErr) throw inqErr;
      setInquiries(inqData || []);
    } catch (err) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Subscriptions setup
  useEffect(() => {
    fetchData();

    // Subscribe to inquiries updates
    const inquiriesChannel = supabase
      .channel('inquiries_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to customers updates
    const customersChannel = supabase
      .channel('customers_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inquiriesChannel);
      supabase.removeChannel(customersChannel);
    };
  }, []);

  // Theme Sync effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Toggle Theme helper
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Stale check logic: returns true if last activity was > 3 days ago
  const isStale = (lastActivityDateStr) => {
    if (!lastActivityDateStr) return false;
    const diffTime = Math.abs(new Date() - new Date(lastActivityDateStr));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  };

  // Analytics helper calculations
  const totalInquiries = inquiries.length;
  const pendingQuotations = inquiries.filter(i => !i.quotation_number && i.status !== 'Canceled').length;
  const followUpCount = inquiries.filter(i => i.status === 'Follow Up').length;
  const wonOrdersCount = inquiries.filter(i => i.status === 'PO Won').length;
  
  // Stale inquiries count
  const staleInquiries = inquiries.filter(i => isStale(i.last_activity_at) && i.status !== 'PO Won' && i.status !== 'Canceled');
  const staleCount = staleInquiries.length;

  // PIC workload map
  const picWorkload = inquiries.reduce((acc, inq) => {
    const pic = inq.customers?.pic_name || 'Unassigned';
    if (inq.status !== 'PO Won' && inq.status !== 'Canceled') {
      acc[pic] = (acc[pic] || 0) + 1;
    }
    return acc;
  }, {});

  // Conversion rate: Won / (Won + Canceled + Follow up + Quoted...)
  const conversionRate = totalInquiries > 0 
    ? Math.round((wonOrdersCount / totalInquiries) * 100) 
    : 0;

  // Filtering Logic for Inquiries Table
  const filteredInquiries = inquiries.filter(inq => {
    const custName = inq.customers?.company_name || '';
    const itemName = inq.item_name || '';
    const qNo = inq.quotation_number || '';
    const picName = inq.customers?.pic_name || '';
    const category = inq.category || '';
    const status = inq.status || '';

    const matchesSearch = 
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qNo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ? true : status === statusFilter;
    const matchesPIC = picFilter === 'all' ? true : picName === picFilter;
    const matchesCategory = categoryFilter === 'all' ? true : category === categoryFilter;

    return matchesSearch && matchesStatus && matchesPIC && matchesCategory;
  });

  // Action: Add new Customer
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('customers')
        .insert([newCustomer]);
      if (error) throw error;
      
      // Reset & Close
      setNewCustomer({
        company_name: '',
        sector_business: '',
        regional: '',
        address: '',
        email_address: '',
        pic_name: '',
        status_email: 'Active'
      });
      setIsAddCustomerOpen(false);
      fetchData();
    } catch (err) {
      alert('Error creating customer: ' + err.message);
    }
  };

  // Action: Add new Inquiry
  const handleAddInquiry = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newInquiry,
        lead_time_days: newInquiry.lead_time_days ? parseInt(newInquiry.lead_time_days) : null,
        quotation_number: newInquiry.quotation_number || null,
        last_activity_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('inquiries')
        .insert([payload]);
      if (error) throw error;

      // Reset & Close
      setNewInquiry({
        customer_id: '',
        category: 'standard',
        item_name: '',
        quotation_number: '',
        lead_time_days: '',
        remark: '',
        status: 'Pending Quotation'
      });
      setIsAddInquiryOpen(false);
      fetchData();
    } catch (err) {
      alert('Error creating inquiry: ' + err.message);
    }
  };

  // Action: Edit / Update existing inquiry in side drawer
  const handleUpdateInquiry = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        quotation_number: selectedInquiry.quotation_number || null,
        lead_time_days: selectedInquiry.lead_time_days ? parseInt(selectedInquiry.lead_time_days) : null,
        po_number: selectedInquiry.po_number || null,
        order_review: selectedInquiry.order_review || null,
        remark: selectedInquiry.remark || '',
        status: selectedInquiry.status,
        last_activity_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('inquiries')
        .update(payload)
        .eq('id', selectedInquiry.id);
      if (error) throw error;

      setIsDrawerOpen(false);
      setSelectedInquiry(null);
      fetchData();
    } catch (err) {
      alert('Error updating inquiry: ' + err.message);
    }
  };

  // Open Drawer and populate values
  const openInquiryDrawer = (inq) => {
    setSelectedInquiry({ ...inq });
    setIsDrawerOpen(true);
  };

  return (
    <div className="app-container">
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div>
          <div className="logo-section">
            <div className="logo-icon">C</div>
            <span className="logo-text">CRM Core</span>
          </div>

          <nav className="nav-links">
            <div 
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </div>
            <div 
              className={`nav-link ${activeTab === 'inquiries' ? 'active' : ''}`}
              onClick={() => setActiveTab('inquiries')}
            >
              <FileText size={20} />
              Inquiries Pipeline
            </div>
            <div 
              className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              <Users size={20} />
              Customer Contact
            </div>
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyCentent: 'center', fontWeight: 'bold', color: '#fff', textAlign: 'center', lineHeight: '36px', justifyContent: 'center' }}>H</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600' }}>P. Handy</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE VIEW */}
      <main className="main-content">
        <header className="top-bar">
          <h1 className="page-title">
            {activeTab === 'dashboard' && '📊 Dashboard Analytics'}
            {activeTab === 'inquiries' && '📁 Inquiries Pipeline'}
            {activeTab === 'customers' && '👥 Customer Directory'}
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'customers' && (
              <button className="action-btn" onClick={() => setIsAddCustomerOpen(true)}>
                <Plus size={18} /> Add Customer
              </button>
            )}
            <button className="action-btn" onClick={() => setIsAddInquiryOpen(true)}>
              <Plus size={18} /> New Inquiry
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* A. KPI BANNER RIBBON (Visible on all tabs for high overview) */}
          <section className="kpi-row">
            <div className="glass-panel kpi-card">
              <span className="kpi-title">Total Inquiries</span>
              <div className="kpi-value">
                {totalInquiries}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>requests</span>
              </div>
              <div className="kpi-indicator" style={{ background: 'var(--color-accent)' }}></div>
            </div>

            <div className="glass-panel kpi-card">
              <span className="kpi-title">Pending Quotation</span>
              <div className="kpi-value" style={{ color: 'var(--color-pending)' }}>
                {pendingQuotations}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>waiting</span>
              </div>
              <div className="kpi-indicator" style={{ background: 'var(--color-pending)' }}></div>
            </div>

            <div className="glass-panel kpi-card">
              <span className="kpi-title">Active Follow-up</span>
              <div className="kpi-value" style={{ color: 'var(--color-follow)' }}>
                {followUpCount}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>leads</span>
              </div>
              <div className="kpi-indicator" style={{ background: 'var(--color-follow)' }}></div>
            </div>

            <div className="glass-panel kpi-card">
              <span className="kpi-title">Stale Follow-up (3d+)</span>
              <div className="kpi-value" style={{ color: 'var(--color-stale)' }}>
                {staleCount}
                {staleCount > 0 && <span className="stale-pulse" style={{ width: '10px', height: '10px', marginLeft: '8px' }}></span>}
              </div>
              <div className="kpi-indicator" style={{ background: 'var(--color-stale)' }}></div>
            </div>

            <div className="glass-panel kpi-card">
              <span className="kpi-title">Won Conversion</span>
              <div className="kpi-value" style={{ color: 'var(--color-won)' }}>
                {conversionRate}%
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({wonOrdersCount} POs)</span>
              </div>
              <div className="kpi-indicator" style={{ background: 'var(--color-won)' }}></div>
            </div>
          </section>

          {loading ? (
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ color: 'var(--text-muted)' }}>Loading CRM database securely...</p>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              `}} />
            </div>
          ) : (
            <>
              {/* TAB 1: DASHBOARD VIEW */}
              {activeTab === 'dashboard' && (
                <div className="dashboard-grid">
                  {/* Left Column: Stale follow-up items needing immediate attention */}
                  <div className="glass-panel section-card">
                    <div className="section-header">
                      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle color="var(--color-stale)" size={20} />
                        Stale Inquiries Needing Action (No Activity &gt; 3 Days)
                      </h2>
                    </div>

                    {staleCount === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 color="var(--color-won)" size={48} style={{ marginBottom: '12px' }} />
                        <p style={{ fontWeight: '500', color: 'var(--text-main)' }}>Outstanding! No stale inquiries.</p>
                        <p style={{ fontSize: '13px' }}>All active inquiries have been updated recently.</p>
                      </div>
                    ) : (
                      <div className="table-container">
                        <table className="crm-table">
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th>Item Name</th>
                              <th>Quot. #</th>
                              <th>Status</th>
                              <th>Last Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staleInquiries.map(inq => (
                              <tr key={inq.id} onClick={() => openInquiryDrawer(inq)}>
                                <td style={{ fontWeight: '600' }}>
                                  <span className="stale-pulse"></span>
                                  {inq.customers?.company_name}
                                </td>
                                <td>{inq.item_name}</td>
                                <td style={{ color: inq.quotation_number ? 'var(--text-main)' : 'var(--color-pending)' }}>
                                  {inq.quotation_number || 'Missing'}
                                </td>
                                <td>
                                  <span className="status-badge badge-stale">Stale Follow-up</span>
                                </td>
                                <td style={{ color: 'var(--color-stale)', fontWeight: '500' }}>
                                  {new Date(inq.last_activity_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Workload breakdown and Quick Stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="glass-panel section-card">
                      <div className="section-header">
                        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Briefcase size={20} color="var(--color-accent)" />
                          PIC Active Inquiries
                        </h2>
                      </div>
                      <div className="chart-container">
                        {Object.entries(picWorkload).length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active assignments.</p>
                        ) : (
                          Object.entries(picWorkload).map(([pic, count]) => {
                            const percentage = Math.min(100, Math.max(10, (count / inquiries.length) * 100));
                            return (
                              <div className="bar-row" key={pic}>
                                <div className="bar-label">
                                  <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>{pic}</span>
                                  <span>{count} inquiries</span>
                                </div>
                                <div className="bar-outer">
                                  <div className="bar-inner" style={{ width: `${percentage}%` }}></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="glass-panel section-card">
                      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} color="var(--color-won)" />
                        Pipeline Summary
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Won Purchase Orders</span>
                          <span style={{ fontWeight: '700', color: 'var(--color-won)' }}>{wonOrdersCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Follow Up Inquiries</span>
                          <span style={{ fontWeight: '700', color: 'var(--color-follow)' }}>{followUpCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Canceled Inquiries</span>
                          <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>
                            {inquiries.filter(i => i.status === 'Canceled').length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total In Pipeline</span>
                          <span style={{ fontWeight: '700' }}>{inquiries.filter(i => i.status !== 'PO Won' && i.status !== 'Canceled').length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INQUIRIES PIPELINE VIEW */}
              {activeTab === 'inquiries' && (
                <div className="glass-panel section-card">
                  {/* SEARCH, CATEGORY, STATUS, & PIC FILTERS */}
                  <div className="pipeline-controls">
                    <div className="search-bar">
                      <Search size={18} color="var(--text-muted)" />
                      <input 
                        type="text" 
                        placeholder="Search customer, item, or quotation..." 
                        className="search-input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="filter-group">
                      <select 
                        className="filter-select"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                      >
                        <option value="all">All Types</option>
                        <option value="standard">Standard</option>
                        <option value="tvb">TVB</option>
                      </select>

                      <select 
                        className="filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="Pending Quotation">Pending Quotation</option>
                        <option value="Quotation Sent">Quotation Sent</option>
                        <option value="Follow Up">Follow Up</option>
                        <option value="PO Won">PO Won</option>
                        <option value="Canceled">Canceled</option>
                      </select>

                      <select 
                        className="filter-select"
                        value={picFilter}
                        onChange={e => setPicFilter(e.target.value)}
                      >
                        <option value="all">All PICs</option>
                        {Array.from(new Set(customers.map(c => c.pic_name).filter(Boolean))).map(pic => (
                          <option key={pic} value={pic}>{pic}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* DATA TABLE */}
                  {filteredInquiries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={40} style={{ marginBottom: '12px' }} />
                      <p style={{ fontWeight: '500' }}>No inquiries match your filters.</p>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Inquiry Date</th>
                            <th>Customer</th>
                            <th>Item Name</th>
                            <th>Type</th>
                            <th>Quot. #</th>
                            <th>Lead Time</th>
                            <th>PIC</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInquiries.map(inq => {
                            const isStaleItem = isStale(inq.last_activity_at) && inq.status !== 'PO Won' && inq.status !== 'Canceled';
                            return (
                              <tr key={inq.id} onClick={() => openInquiryDrawer(inq)}>
                                <td>{new Date(inq.inquiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td style={{ fontWeight: '600' }}>
                                  {isStaleItem && <span className="stale-pulse"></span>}
                                  {inq.customers?.company_name}
                                </td>
                                <td>{inq.item_name}</td>
                                <td>
                                  <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                    {inq.category}
                                  </span>
                                </td>
                                <td style={{ color: inq.quotation_number ? 'inherit' : 'var(--color-pending)', fontWeight: inq.quotation_number ? 'normal' : '600' }}>
                                  {inq.quotation_number || 'Waiting Input'}
                                </td>
                                <td>{inq.lead_time_days ? `${inq.lead_time_days} days` : '-'}</td>
                                <td style={{ fontWeight: '500' }}>{inq.customers?.pic_name}</td>
                                <td>
                                  {isStaleItem ? (
                                    <span className="status-badge badge-stale">Stale Follow-up</span>
                                  ) : (
                                    <>
                                      {inq.status === 'PO Won' && <span className="status-badge badge-won">PO Won</span>}
                                      {inq.status === 'Pending Quotation' && <span className="status-badge badge-pending">Pending Quotation</span>}
                                      {inq.status === 'Quotation Sent' && <span className="status-badge badge-pending" style={{ color: 'var(--color-accent)', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'var(--color-accent-glow)' }}>Quotation Sent</span>}
                                      {inq.status === 'Follow Up' && <span className="status-badge badge-follow">Follow Up</span>}
                                      {inq.status === 'Canceled' && <span className="status-badge badge-canceled">Canceled</span>}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CUSTOMERS VIEW */}
              {activeTab === 'customers' && (
                <div className="glass-panel section-card">
                  <div className="pipeline-controls">
                    <div className="search-bar">
                      <Search size={18} color="var(--text-muted)" />
                      <input 
                        type="text" 
                        placeholder="Search company, address, or PIC..." 
                        className="search-input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {customers.filter(c => 
                    c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.pic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.regional.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <Users size={40} style={{ marginBottom: '12px' }} />
                      <p style={{ fontWeight: '500' }}>No customers registered.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                      {customers.filter(c => 
                        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.pic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.regional.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(cust => {
                        const custInquiries = inquiries.filter(i => i.customer_id === cust.id);
                        const wonInquiries = custInquiries.filter(i => i.status === 'PO Won');
                        return (
                          <div key={cust.id} className="glass-panel section-card glass-panel-hover" style={{ gap: '16px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building size={20} color="var(--color-accent)" />
                                <h3 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>{cust.company_name}</h3>
                              </div>
                              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', fontWeight: '500' }}>
                                {cust.sector_business || 'General Sector'} • {cust.regional}
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '12px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                <Mail size={16} />
                                <span style={{ color: 'var(--text-main)' }}>{cust.email_address || 'No email registered'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                <MapPin size={16} />
                                <span style={{ color: 'var(--text-main)' }}>{cust.address || 'No address registered'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                <UserCheck size={16} />
                                <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>PIC: {cust.pic_name || 'Unassigned'}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Inquiries: </span>
                                <span style={{ fontWeight: '700' }}>{custInquiries.length}</span>
                                <span style={{ color: 'var(--text-muted)' }}> (Won: </span>
                                <span style={{ fontWeight: '700', color: 'var(--color-won)' }}>{wonInquiries.length}</span>
                                <span style={{ color: 'var(--text-muted)' }}>)</span>
                              </div>
                              <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: 'var(--color-won)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
                                {cust.status_email}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 3. SLIDE-OUT EDIT DRAWER */}
      <div 
        className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
      />
      <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Edit Inquiry Details</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {selectedInquiry?.customers?.company_name}
            </p>
          </div>
          <button className="drawer-close" onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}>
            <X size={20} />
          </button>
        </div>

        {selectedInquiry && (
          <form className="drawer-body" onSubmit={handleUpdateInquiry}>
            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={selectedInquiry.item_name}
                disabled 
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category Type</label>
              <input 
                type="text" 
                className="form-input" 
                value={selectedInquiry.category.toUpperCase()}
                disabled 
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-pending)', display: 'flex', justifyContent: 'space-between' }}>
                Quotation Number 
                {!selectedInquiry.quotation_number && <span style={{ fontSize: '11px', fontWeight: 'normal' }}>⚠️ Missing input</span>}
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter quotation # (e.g. Q-2026-0099)" 
                value={selectedInquiry.quotation_number || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, quotation_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Lead Time (Working Days)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Number of days" 
                value={selectedInquiry.lead_time_days || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, lead_time_days: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Inquiry Status</label>
              <select 
                className="form-select"
                value={selectedInquiry.status}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, status: e.target.value })}
              >
                <option value="Pending Quotation">Pending Quotation</option>
                <option value="Quotation Sent">Quotation Sent</option>
                <option value="Follow Up">Follow Up</option>
                <option value="PO Won">PO Won</option>
                <option value="Canceled">Canceled</option>
              </select>
            </div>

            {selectedInquiry.status === 'PO Won' && (
              <>
                <div className="form-group">
                  <label className="form-label">Purchase Order (PO) Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter PO # (e.g. PO-889922)" 
                    value={selectedInquiry.po_number || ''}
                    onChange={e => setSelectedInquiry({ ...selectedInquiry, po_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Order Review Notes</label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Enter details about PO alignment review..." 
                    value={selectedInquiry.order_review || ''}
                    onChange={e => setSelectedInquiry({ ...selectedInquiry, order_review: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Follow-up Remarks / Notes</label>
              <textarea 
                className="form-textarea" 
                placeholder="Add latest activities or conversation notes..." 
                value={selectedInquiry.remark || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, remark: e.target.value })}
              />
            </div>

            <div className="drawer-footer">
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
              >
                Cancel
              </button>
              <button type="submit" className="save-btn">
                Save Updates
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. MODAL POPUP: ADD INQUIRY */}
      <div className={`modal-overlay ${isAddInquiryOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-title">Log New Inquiry</h2>
            <button className="modal-close" onClick={() => setIsAddInquiryOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form className="modal-body" onSubmit={handleAddInquiry}>
            <div className="form-group">
              <label className="form-label">Select Customer</label>
              <select 
                className="form-select"
                required
                value={newInquiry.customer_id}
                onChange={e => setNewInquiry({ ...newInquiry, customer_id: e.target.value })}
              >
                <option value="">-- Choose Company --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} (PIC: {c.pic_name})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Inquiry Category</label>
              <select 
                className="form-select"
                value={newInquiry.category}
                onChange={e => setNewInquiry({ ...newInquiry, category: e.target.value })}
              >
                <option value="standard">Standard Inquiry</option>
                <option value="tvb">TVB Inquiry</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Item / Product Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter item description..." 
                required
                value={newInquiry.item_name}
                onChange={e => setNewInquiry({ ...newInquiry, item_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quotation Number (Optional)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Can be inputted later" 
                value={newInquiry.quotation_number}
                onChange={e => setNewInquiry({ ...newInquiry, quotation_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Est. Lead Time (Working Days)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 5" 
                value={newInquiry.lead_time_days}
                onChange={e => setNewInquiry({ ...newInquiry, lead_time_days: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Remarks</label>
              <textarea 
                className="form-textarea" 
                placeholder="Enter initial context or demands..." 
                value={newInquiry.remark}
                onChange={e => setNewInquiry({ ...newInquiry, remark: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="cancel-btn" onClick={() => setIsAddInquiryOpen(false)}>Cancel</button>
              <button type="submit" className="save-btn">Log Inquiry</button>
            </div>
          </form>
        </div>
      </div>

      {/* 5. MODAL POPUP: ADD CUSTOMER */}
      <div className={`modal-overlay ${isAddCustomerOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-title">Register New Customer</h2>
            <button className="modal-close" onClick={() => setIsAddCustomerOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form className="modal-body" onSubmit={handleAddCustomer}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. BOSCH AUTO SVC" 
                required
                value={newCustomer.company_name}
                onChange={e => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sector Business</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Automotive, Manufacturing" 
                value={newCustomer.sector_business}
                onChange={e => setNewCustomer({ ...newCustomer, sector_business: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Regional</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Asia, North America, Europe" 
                value={newCustomer.regional}
                onChange={e => setNewCustomer({ ...newCustomer, regional: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="customer@email.com" 
                value={newCustomer.email_address}
                onChange={e => setNewCustomer({ ...newCustomer, email_address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Full Address</label>
              <textarea 
                className="form-textarea" 
                placeholder="Enter postal street address..." 
                value={newCustomer.address}
                onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned PIC</label>
              <select 
                className="form-select"
                required
                value={newCustomer.pic_name}
                onChange={e => setNewCustomer({ ...newCustomer, pic_name: e.target.value })}
              >
                <option value="">-- Select Team Member --</option>
                <option value="AFIF NI">AFIF NI</option>
                <option value="PUTRI">PUTRI</option>
                <option value="NOVY">NOVY</option>
                <option value="ERVAN">ERVAN</option>
                <option value="RANU">RANU</option>
              </select>
            </div>

            <div className="modal-footer">
              <button type="button" className="cancel-btn" onClick={() => setIsAddCustomerOpen(false)}>Cancel</button>
              <button type="submit" className="save-btn">Add Customer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
