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
  UserCheck,
  Lock,
  LogOut,
  Menu,
  DollarSign
} from 'lucide-react';

// Helper to calculate working days (excluding weekends) between two dates
const calculateWorkingDays = (startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) return '';
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
  if (startDate > endDate) return 0;
  
  let count = 0;
  let curDate = new Date(startDate.getTime());
  // Advance by 1 day to measure gap (similar to excel lead time days calculation)
  curDate.setDate(curDate.getDate() + 1);
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sun (0) and Sat (6)
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

// Helper to calculate days open (Today - InquiryDate)
const getDaysOpen = (inquiryDateStr) => {
  if (!inquiryDateStr) return 0;
  const start = new Date(inquiryDateStr);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
};

// Helper to calculate total value of an inquiry (items total + tooling costs)
const getInquiryTotal = (inq) => {
  const currencySym = inq.currency === 'EUR' ? '€' : inq.currency === 'IDR' ? 'Rp' : '$';
  const items = inq.inquiry_items || [];
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
  const toolingTotal = items.reduce((sum, item) => sum + (parseFloat(item.tooling_cost) || 0), 0);
  const grandTotal = itemsTotal + toolingTotal;
  if (grandTotal === 0) return '-';
  return `${currencySym} ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper to resolve aggregate status based on individual items
const getAggregateStatus = (inq) => {
  const items = inq.inquiry_items || [];
  if (items.length === 0) return inq.status || 'Pending Quotation';
  
  const total = items.length;
  const statuses = items.map(item => item.status || 'Pending Quotation');
  const wonCount = statuses.filter(s => s === 'PO Won').length;
  const canceledCount = statuses.filter(s => s === 'Canceled').length;
  
  if (wonCount === total) return 'PO Won';
  if (canceledCount === total) return 'Canceled';
  
  if (wonCount > 0) {
    return `PO Won (${wonCount}/${total})`;
  }
  
  if (statuses.includes('Follow Up')) return 'Follow Up';
  if (statuses.includes('Submitted')) return 'Submitted';
  return 'Pending Quotation';
};

export default function CRMHome() {
  // Authentication States
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // Navigation & Theme States
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'inquiries', 'customers'
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Database States
  const [inquiries, setInquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [picFilter, setPicFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sorting States
  const [sortField, setSortField] = useState('inquiry_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showOnlyPendingQuotes, setShowOnlyPendingQuotes] = useState(false);

  // Helper to get dynamic inquiry total as a number for numerical sorting & aggregates
  const getInquiryTotalNumeric = (inq) => {
    const items = inq.inquiry_items || [];
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
    const toolingTotal = items.reduce((sum, item) => sum + (parseFloat(item.tooling_cost) || 0), 0);
    const grandTotal = itemsTotal + toolingTotal;
    const rate = inq.currency === 'EUR' ? 1.08 : inq.currency === 'IDR' ? 1 / 16200 : 1.0;
    return grandTotal * rate;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  // Active Modals & Selected Drawer State
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddInquiryOpen, setIsAddInquiryOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Drawing upload states
  const [itemDrawings, setItemDrawings] = useState({});   // { [itemId]: DrawingRow[] }
  const [drawingsLoading, setDrawingsLoading] = useState(false);

  // PDF viewer states
  const [viewerDrawing, setViewerDrawing] = useState(null);
  const [viewerUrl, setViewerUrl]         = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Form states for new inquiry
  const [newInquiry, setNewInquiry] = useState({
    customer_id: '',
    category: 'others',
    items: [{
      item_name: '',
      material: '',
      process: '',
      tipe_proses: 'others',
      qty: 1,
      cast_price: '',
      mach_price: '',
      surface_treatment: '',
      packing_cost: '',
      cfr: '',
      tooling_cost: ''
    }],
    quotation_number: '',
    lead_time_days: '',
    remark: '',
    status: 'Pending Quotation',
    currency: 'USD'
  });

  // Form states for new customer
  const [newCustomer, setNewCustomer] = useState({
    company_name: '',
    sector_business: '',
    regional: '',
    address: '',
    email_address: '',
    pic_name: '',
    client_contact_person: '',
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

      // Fetch inquiries with customer and sub-items joins
      const { data: inqData, error: inqErr } = await supabase
        .from('inquiries')
        .select(`
          *,
          customers (
            company_name,
            pic_name,
            client_contact_person
          ),
          inquiry_items (
            *
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

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time Subscriptions setup when authenticated
  useEffect(() => {
    if (!session) return;
    
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

    // Subscribe to inquiry_items updates
    const inquiryItemsChannel = supabase
      .channel('inquiry_items_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiry_items' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inquiriesChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(inquiryItemsChannel);
    };
  }, [session]);

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

  // Auth Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthActionLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        // OWASP top 10 safe enumeration error messages
        setAuthError('Invalid login credentials. Please try again.');
      }
    } catch (err) {
      setAuthError('An unexpected server error occurred.');
    } finally {
      setAuthActionLoading(false);
    }
  };

  // Auth Sign Out Handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
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

  // Conversion rate: Won / Total
  const conversionRate = totalInquiries > 0 
    ? Math.round((wonOrdersCount / totalInquiries) * 100) 
    : 0;

  // Active Pipeline Value Calculation
  const activePipelineInquiries = inquiries.filter(i => i.status !== 'PO Won' && i.status !== 'Canceled');
  const activePipelineValueUSD = activePipelineInquiries.reduce((sum, i) => sum + getInquiryTotalNumeric(i), 0);
  const activePipelineCount = activePipelineInquiries.length;

  const formatPipelineValueUSD = () => {
    return `$ ${activePipelineValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtering Logic for Inquiries Table
  const filteredInquiries = inquiries.filter(inq => {
    if (showOnlyPendingQuotes) {
      const isPending = !inq.quotation_number && inq.status !== 'Canceled';
      if (!isPending) return false;
    }
    const custName = inq.customers?.company_name || '';
    const qNo = inq.quotation_number || '';
    const picName = inq.customers?.pic_name || '';
    const category = inq.category || '';
    const status = inq.status || '';
    const items = inq.inquiry_items || [];

    const matchesSearch = 
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      items.some(item => 
        (item.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.material || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.process || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.tipe_proses || '').toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus = statusFilter === 'all' ? true : status === statusFilter;
    const matchesPIC = picFilter === 'all' ? true : picName === picFilter;
    const matchesCategory = categoryFilter === 'all' ? true : category === categoryFilter;

    return matchesSearch && matchesStatus && matchesPIC && matchesCategory;
  });

  // Sorting Logic for Inquiries Table
  const sortedFilteredInquiries = [...filteredInquiries].sort((a, b) => {
    let valA, valB;
    if (sortField === 'inquiry_date') {
      valA = new Date(a.inquiry_date || 0).getTime();
      valB = new Date(b.inquiry_date || 0).getTime();
    } else if (sortField === 'customer') {
      valA = (a.customers?.company_name || '').toLowerCase();
      valB = (b.customers?.company_name || '').toLowerCase();
    } else if (sortField === 'quotation_number') {
      valA = (a.quotation_number || '').toLowerCase();
      valB = (b.quotation_number || '').toLowerCase();
    } else if (sortField === 'pic') {
      valA = (a.customers?.pic_name || '').toLowerCase();
      valB = (b.customers?.pic_name || '').toLowerCase();
    } else if (sortField === 'status') {
      valA = (a.status || '').toLowerCase();
      valB = (b.status || '').toLowerCase();
    } else if (sortField === 'value') {
      valA = getInquiryTotalNumeric(a);
      valB = getInquiryTotalNumeric(b);
    } else {
      return 0;
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
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
        client_contact_person: '',
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
      // 1. Insert the Inquiry first
      const inqPayload = {
        customer_id: newInquiry.customer_id,
        category: newInquiry.category,
        quotation_number: newInquiry.quotation_number || null,
        lead_time_days: newInquiry.lead_time_days ? parseInt(newInquiry.lead_time_days) : null,
        remark: newInquiry.remark || '',
        status: newInquiry.status,
        currency: newInquiry.currency || 'USD',
        last_activity_at: new Date().toISOString()
      };
      
      const { data: createdInqs, error: inqErr } = await supabase
        .from('inquiries')
        .insert([inqPayload])
        .select();
      if (inqErr) throw inqErr;
      if (!createdInqs || createdInqs.length === 0) {
        throw new Error('Failed to retrieve created Inquiry record.');
      }
      
      const newInqId = createdInqs[0].id;

      // 2. Insert corresponding items referencing newInqId
      const itemsPayload = newInquiry.items.map(item => {
        const castPrice = item.cast_price ? parseFloat(item.cast_price) : 0;
        const machPrice = item.mach_price ? parseFloat(item.mach_price) : 0;
        const surfaceTreatment = item.surface_treatment ? parseFloat(item.surface_treatment) : 0;
        const packingCost = item.packing_cost ? parseFloat(item.packing_cost) : 0;
        const cfr = item.cfr ? parseFloat(item.cfr) : 0;
        const qty = item.qty ? parseInt(item.qty) : 0;
        const totalPricePerQty = castPrice + machPrice + surfaceTreatment + packingCost + cfr;
        const totalPrice = totalPricePerQty * qty;

        return {
          inquiry_id: newInqId,
          item_name: item.item_name || 'Unnamed Item',
          material: item.material || null,
          process: item.process || null,
          tipe_proses: item.tipe_proses || null,
          qty: qty || null,
          cast_price: (item.cast_price !== '' && item.cast_price !== null) ? parseFloat(item.cast_price) : null,
          mach_price: (item.mach_price !== '' && item.mach_price !== null) ? parseFloat(item.mach_price) : null,
          surface_treatment: (item.surface_treatment !== '' && item.surface_treatment !== null) ? parseFloat(item.surface_treatment) : null,
          packing_cost: (item.packing_cost !== '' && item.packing_cost !== null) ? parseFloat(item.packing_cost) : null,
          cfr: (item.cfr !== '' && item.cfr !== null) ? parseFloat(item.cfr) : null,
          total_price_per_qty: totalPricePerQty || null,
          total_price: totalPrice || null,
          tooling_cost: (item.tooling_cost !== '' && item.tooling_cost !== null) ? parseFloat(item.tooling_cost) : null,
          status: 'Pending Quotation'
        };
      });

      const { error: itemsErr } = await supabase
        .from('inquiry_items')
        .insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // Reset & Close
      setNewInquiry({
        customer_id: '',
        category: 'others',
        items: [{
          item_name: '',
          material: '',
          process: '',
          tipe_proses: 'others',
          qty: 1,
          cast_price: '',
          mach_price: '',
          surface_treatment: '',
          packing_cost: '',
          cfr: '',
          tooling_cost: ''
        }],
        quotation_number: '',
        lead_time_days: '',
        remark: '',
        status: 'Pending Quotation',
        currency: 'USD'
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
      // 1. Update the parent inquiry
      const payload = {
        category: selectedInquiry.category,
        quotation_date: selectedInquiry.quotation_date || null,
        quotation_number: selectedInquiry.quotation_number || null,
        lead_time_days: selectedInquiry.lead_time_days ? parseInt(selectedInquiry.lead_time_days) : null,
        po_number: selectedInquiry.po_number || null,
        order_review: selectedInquiry.order_review || null,
        remark: selectedInquiry.remark || '',
        status: selectedInquiry.status,
        currency: selectedInquiry.currency || 'USD',
        last_activity_at: new Date().toISOString()
      };

      const { error: inqErr } = await supabase
        .from('inquiries')
        .update(payload)
        .eq('id', selectedInquiry.id);
      if (inqErr) throw inqErr;

      // 2. Synchronize nested inquiry items
      const currentItems = selectedInquiry.inquiry_items || [];
      const itemIdsToKeep = currentItems.filter(item => item.id).map(item => item.id);

      // Delete items removed in UI
      if (itemIdsToKeep.length > 0) {
        const { error: deleteErr } = await supabase
          .from('inquiry_items')
          .delete()
          .eq('inquiry_id', selectedInquiry.id)
          .not('id', 'in', `(${itemIdsToKeep.join(',')})`);
        if (deleteErr) throw deleteErr;
      } else {
        const { error: deleteErr } = await supabase
          .from('inquiry_items')
          .delete()
          .eq('inquiry_id', selectedInquiry.id);
        if (deleteErr) throw deleteErr;
      }

      // Upsert remaining items
      if (currentItems.length > 0) {
        const itemsToUpsert = currentItems.map(item => {
          const castPrice = item.cast_price ? parseFloat(item.cast_price) : 0;
          const machPrice = item.mach_price ? parseFloat(item.mach_price) : 0;
          const surfaceTreatment = item.surface_treatment ? parseFloat(item.surface_treatment) : 0;
          const packingCost = item.packing_cost ? parseFloat(item.packing_cost) : 0;
          const cfr = item.cfr ? parseFloat(item.cfr) : 0;
          const qty = item.qty ? parseInt(item.qty) : 0;
          const totalPricePerQty = castPrice + machPrice + surfaceTreatment + packingCost + cfr;
          const totalPrice = totalPricePerQty * qty;

          return {
            id: item.id || undefined,
            inquiry_id: selectedInquiry.id,
            item_name: item.item_name || 'Unnamed Item',
            material: item.material || null,
            process: item.process || null,
            tipe_proses: item.tipe_proses || null,
            qty: qty || null,
            cast_price: (item.cast_price !== '' && item.cast_price !== null) ? parseFloat(item.cast_price) : null,
            mach_price: (item.mach_price !== '' && item.mach_price !== null) ? parseFloat(item.mach_price) : null,
            surface_treatment: (item.surface_treatment !== '' && item.surface_treatment !== null) ? parseFloat(item.surface_treatment) : null,
            packing_cost: (item.packing_cost !== '' && item.packing_cost !== null) ? parseFloat(item.packing_cost) : null,
            cfr: (item.cfr !== '' && item.cfr !== null) ? parseFloat(item.cfr) : null,
            total_price_per_qty: totalPricePerQty || null,
            total_price: totalPrice || null,
            tooling_cost: (item.tooling_cost !== '' && item.tooling_cost !== null) ? parseFloat(item.tooling_cost) : null,
            // Sync Status and FAI checklist columns:
            status: item.status || 'Pending Quotation',
            fai_status: item.fai_status || 'Pending',
            fai_engineer: item.fai_engineer || null,
            fai_dimensions: item.fai_dimensions || 'Pending',
            fai_material_cert: item.fai_material_cert || 'Pending',
            fai_test_report: item.fai_test_report || 'Pending',
            fai_remarks: item.fai_remarks || null,
            fai_date: item.fai_date || null
          };
        });

        const { error: upsertErr } = await supabase
          .from('inquiry_items')
          .upsert(itemsToUpsert);
        if (upsertErr) throw upsertErr;
      }

      setIsDrawerOpen(false);
      setSelectedInquiry(null);
      fetchData();
    } catch (err) {
      alert('Error updating inquiry: ' + err.message);
    }
  };

  // Open Drawer and populate values
  const openInquiryDrawer = (inq) => {
    const items = (inq.inquiry_items || []).map(item => ({
      ...item,
      showFai: item.status === 'PO Won' ? true : !!item.showFai,
      showDetails: item.status === 'PO Won' ? true : !!item.showDetails
    }));
    setSelectedInquiry({ ...inq, inquiry_items: items });
    setIsDrawerOpen(true);
    setItemDrawings({});
    fetchDrawingsForItems(items);
  };

  // Fetch drawings for all items in the opened inquiry
  const fetchDrawingsForItems = async (items) => {
    const itemIds = items.map(i => i.id).filter(Boolean);
    if (itemIds.length === 0) return;
    setDrawingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('item_drawings')
        .select('*')
        .in('inquiry_item_id', itemIds)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      const grouped = {};
      (data || []).forEach(d => {
        if (!grouped[d.inquiry_item_id]) grouped[d.inquiry_item_id] = [];
        grouped[d.inquiry_item_id].push(d);
      });
      setItemDrawings(grouped);
    } catch (err) {
      console.error('Error fetching drawings:', err.message);
    } finally {
      setDrawingsLoading(false);
    }
  };

  // Upload a PDF drawing to Supabase Storage + record in item_drawings
  const handleDrawingUpload = async (itemId, file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Only PDF files are supported.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large. Maximum 20 MB.');
      return;
    }
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${itemId}/${safeName}`;
    try {
      const { error: uploadErr } = await supabase.storage
        .from('drawings')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: row, error: dbErr } = await supabase
        .from('item_drawings')
        .insert([{ inquiry_item_id: itemId, file_name: file.name, storage_path: storagePath }])
        .select()
        .single();
      if (dbErr) throw dbErr;

      setItemDrawings(prev => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), row]
      }));
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  // Delete a drawing from Storage + remove from item_drawings table
  const handleDrawingDelete = async (drawing, itemId) => {
    if (!confirm(`Delete "${drawing.file_name}"?`)) return;
    try {
      const { error: storageErr } = await supabase.storage
        .from('drawings')
        .remove([drawing.storage_path]);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase
        .from('item_drawings')
        .delete()
        .eq('id', drawing.id);
      if (dbErr) throw dbErr;

      setItemDrawings(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || []).filter(d => d.id !== drawing.id)
      }));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Open full-screen PDF viewer with a 1-hour signed URL
  const openDrawingViewer = async (drawing) => {
    setViewerDrawing(drawing);
    setViewerUrl(null);
    setViewerLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.storage_path, 3600);
      if (error) throw error;
      setViewerUrl(data.signedUrl);
    } catch (err) {
      alert('Could not load drawing: ' + err.message);
      setViewerDrawing(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const closeDrawingViewer = () => {
    setViewerDrawing(null);
    setViewerUrl(null);
  };

  // LOADING PORTAL (Session validation in progress)
  if (authLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--text-main)', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'sans-serif', fontSize: '14px' }}>Securing workstation connection...</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER SECURITY LOGIN SCREEN (If not authenticated)
  // ----------------------------------------------------
  if (!session) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100vw', 
        height: '100vh', 
        background: 'var(--bg-app)',
        transition: 'background 0.3s'
      }}>
        <div className="glass-panel" style={{ 
          width: '420px', 
          padding: '40px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, var(--color-accent), var(--color-pending))', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold', margin: '0 auto 16px auto' }}>C</div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>CRM Core Portal</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Admin-Managed Access Portal</p>
          </div>

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Workplace Email</label>
              <input 
                type="email" 
                className="form-input" 
                required 
                placeholder="e.g. administrator@company.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                required 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-stale-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--color-stale)', fontSize: '13px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="action-btn" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
              disabled={authActionLoading}
            >
              {authActionLoading ? 'Authenticating...' : 'Sign In To Workspace'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              Toggle Theme
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER WORKSPACE (If authenticated)
  // ----------------------------------------------------
  const renderSortIcon = (field) => {
    if (sortField !== field) return <span style={{ marginLeft: '6px', opacity: 0.35, fontSize: '11px', display: 'inline-block', transition: 'all 0.2s ease' }}>⇅</span>;
    return <span style={{ marginLeft: '6px', color: 'var(--color-accent)', fontSize: '11px', display: 'inline-block', transition: 'all 0.2s ease' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="app-container">
      {/* 1. SIDEBAR NAVIGATION */}
      {mobileSidebarOpen && (
        <div 
          className="sidebar-backdrop mobile-open" 
          onClick={() => setMobileSidebarOpen(false)} 
        />
      )}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="logo-section" style={{ display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'space-between', alignItems: 'center', padding: sidebarCollapsed ? '0 0 20px 0' : '0 12px 24px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: sidebarCollapsed ? 'auto' : '100%' }}>
              <div className="logo-icon" style={{ flexShrink: 0 }}>C</div>
              {!sidebarCollapsed && <span className="logo-text">CRM Core</span>}
            </div>
            {!sidebarCollapsed && (
              <button 
                onClick={() => setSidebarCollapsed(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' }}
                className="sidebar-toggle-btn"
                title="Collapse Sidebar"
              >
                <Menu size={18} />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <button 
                onClick={() => setSidebarCollapsed(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px' }}
                title="Expand Sidebar"
              >
                <Menu size={18} />
              </button>
            </div>
          )}

          <nav className="nav-links" style={{ gap: '12px' }}>
            <div 
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
              title={sidebarCollapsed ? "Dashboard" : ""}
              style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : '12px' }}
            >
              <LayoutDashboard size={20} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </div>
            <div 
              className={`nav-link ${activeTab === 'inquiries' ? 'active' : ''}`}
              onClick={() => { setActiveTab('inquiries'); setMobileSidebarOpen(false); }}
              title={sidebarCollapsed ? "Inquiries Pipeline" : ""}
              style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : '12px' }}
            >
              <FileText size={20} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && <span>Inquiries Pipeline</span>}
            </div>
            <div 
              className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => { setActiveTab('customers'); setMobileSidebarOpen(false); }}
              title={sidebarCollapsed ? "Customer Contact" : ""}
              style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : '12px' }}
            >
              <Users size={20} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && <span>Customer Contact</span>}
            </div>
          </nav>
        </div>

        <div className="sidebar-footer" style={{ gap: '12px' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            title={sidebarCollapsed ? "Toggle Theme" : ""}
            style={{ padding: sidebarCollapsed ? '10px 0' : '10px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: sidebarCollapsed ? '0' : '10px' }}
          >
            {theme === 'dark' ? <Sun size={18} style={{ flexShrink: 0 }} /> : <Moon size={18} style={{ flexShrink: 0 }} />}
            {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button 
            className="theme-toggle-btn" 
            onClick={handleSignOut} 
            title={sidebarCollapsed ? "Sign Out" : ""}
            style={{ 
              color: 'var(--color-stale)', 
              borderColor: 'rgba(239, 68, 68, 0.2)',
              padding: sidebarCollapsed ? '10px 0' : '10px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '10px'
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: sidebarCollapsed ? '0' : '0 8px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', textAlign: 'center', lineHeight: '36px', flexShrink: 0 }}>
              {session.user.email[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '130px' }}>{session.user.email}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Authorized</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="mobile-hamburger-btn" 
              onClick={() => setMobileSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '6px'
              }}
            >
              <Menu size={20} />
            </button>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'dashboard' && '📊 Dashboard Analytics'}
              {activeTab === 'inquiries' && '📁 Inquiries Pipeline'}
              {activeTab === 'customers' && '👥 Customer Directory'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'customers' && (
              <button className="action-btn" onClick={() => setIsAddCustomerOpen(true)}>
                <Plus size={16} /> Add Customer
              </button>
            )}
            <button className="action-btn" onClick={() => setIsAddInquiryOpen(true)}>
              <Plus size={16} /> New Inquiry
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

            <div 
              className={`glass-panel kpi-card kpi-clickable-card ${showOnlyPendingQuotes ? 'active-filter' : ''}`}
              onClick={() => {
                setShowOnlyPendingQuotes(prev => !prev);
                if (activeTab !== 'inquiries') {
                  setActiveTab('inquiries');
                }
              }}
              style={{ cursor: 'pointer' }}
            >
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
                <>
                  {/* TOP-ROW KPI METRICS GRID */}
                  <div className="kpi-grid">
                    <div className="kpi-card glass-panel">
                      <div className="kpi-header">
                        <span className="kpi-title">Active Pipeline Value</span>
                        <div className="kpi-icon-wrapper val">
                          <DollarSign size={18} />
                        </div>
                      </div>
                      <div className="kpi-value">{formatPipelineValueUSD()}</div>
                      <div className="kpi-desc">Converted dynamic total (USD base)</div>
                    </div>

                    <div className="kpi-card glass-panel">
                      <div className="kpi-header">
                        <span className="kpi-title">Pending Quotations</span>
                        <div className="kpi-icon-wrapper pend">
                          <FileText size={18} />
                        </div>
                      </div>
                      <div className="kpi-value">{pendingQuotations}</div>
                      <div className="kpi-desc">Inquiries missing quotation numbers</div>
                    </div>

                    <div className="kpi-card glass-panel">
                      <div className="kpi-header">
                        <span className="kpi-title">Stale Inquiries</span>
                        <div className="kpi-icon-wrapper stale">
                          <AlertTriangle size={18} />
                        </div>
                      </div>
                      <div className="kpi-value">{staleCount}</div>
                      <div className="kpi-desc">No update activity in &gt; 3 days</div>
                    </div>

                    <div className="kpi-card glass-panel">
                      <div className="kpi-header">
                        <span className="kpi-title">Conversion Rate</span>
                        <div className="kpi-icon-wrapper conv">
                          <TrendingUp size={18} />
                        </div>
                      </div>
                      <div className="kpi-value">{conversionRate}%</div>
                      <div className="kpi-desc">Inquiries won to date</div>
                    </div>
                  </div>

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
                              <th>Items</th>
                              <th>Quot. #</th>
                              <th>Inquiry Value</th>
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
                                <td>
                                  <span className="item-count-badge">
                                    📦 {inq.inquiry_items?.length || 0} {inq.inquiry_items?.length === 1 ? 'Item' : 'Items'}
                                  </span>
                                </td>
                                <td style={{ color: inq.quotation_number ? 'var(--text-main)' : 'var(--color-pending)' }}>
                                  {inq.quotation_number || 'Missing'}
                                </td>
                                <td style={{ fontWeight: '600', color: 'var(--color-won)' }}>
                                  {getInquiryTotal(inq)}
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

                {/* Full-width visual Gantt chart / timeline tracking report for FAI items */}
                  {/* Full-width Section Title Header */}
                  <div style={{ marginTop: '24px', width: '100%', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                      <FileCheck size={22} color="var(--color-won)" />
                      🛠️ Product Engineering FAI Timeline & Quality Tracker
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Visual Gantt milestones for items undergoing First Article Inspection (FAI)
                    </p>
                  </div>

                  {(() => {
                    // Filter items that are PO Won or have active FAI inspections
                    const faiItems = inquiries.flatMap(inq => 
                      (inq.inquiry_items || []).map(item => ({
                        ...item,
                        customerName: inq.customers?.company_name,
                        inquiryDate: inq.inquiry_date,
                        quotationDate: inq.quotation_date,
                        quotationNumber: inq.quotation_number,
                        parentStatus: inq.status,
                        parentId: inq.id,
                        inqRef: inq
                      }))
                    ).filter(item => item.parentStatus === 'PO Won' || item.status === 'PO Won' || (item.fai_status && item.fai_status !== 'Pending'));

                    if (faiItems.length === 0) {
                      return (
                        <div className="glass-panel section-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', width: '100%' }}>
                          <AlertCircle size={36} style={{ marginBottom: '12px', color: 'var(--text-muted)', opacity: 0.6 }} />
                          <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>No Active FAI Tracking Items</p>
                          <p style={{ fontSize: '13px', marginTop: '4px' }}>Items marked as "PO Won" or having active FAI inspections will automatically display a Gantt timeline here.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="fai-gantt-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {faiItems.map((item, idx) => {
                          // Calculate progress based on passed milestones
                          let progress = 0;
                          if (item.fai_dimensions === 'Passed') progress += 33;
                          if (item.fai_material_cert === 'Passed') progress += 33;
                          if (item.fai_test_report === 'Passed') progress += 34;

                          const dimStatus = item.fai_dimensions || 'Pending';
                          const matStatus = item.fai_material_cert || 'Pending';
                          const testStatus = item.fai_test_report || 'Pending';

                          return (
                            <div
                              key={idx}
                              className="glass-panel glass-panel-hover"
                              style={{ cursor: 'pointer', padding: '20px', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
                              onClick={() => openInquiryDrawer(item.inqRef)}
                            >
                              {/* ── Row 1: Header — identity + status badge ── */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                  <span className="fai-gantt-customer">{item.customerName}</span>
                                  <span className="fai-gantt-item" style={{ fontSize: '15px' }}>{item.item_name}</span>
                                  <span className="fai-gantt-engineer">
                                    👷 Engineer: <strong style={{ color: 'var(--text-main)' }}>{item.fai_engineer || 'Unassigned'}</strong>
                                  </span>
                                </div>
                                <span
                                  className="fai-gantt-status-badge"
                                  style={{
                                    flexShrink: 0,
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: item.fai_status === 'Approved' ? 'rgba(16,185,129,0.12)' : item.fai_status === 'Rejected' ? 'rgba(239,68,68,0.12)' : item.fai_status === 'In Progress' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                                    color: item.fai_status === 'Approved' ? 'var(--color-won)' : item.fai_status === 'Rejected' ? 'var(--color-stale)' : item.fai_status === 'In Progress' ? 'var(--color-follow)' : 'var(--text-muted)',
                                    border: `1px solid ${item.fai_status === 'Approved' ? 'rgba(16,185,129,0.25)' : item.fai_status === 'Rejected' ? 'rgba(239,68,68,0.25)' : item.fai_status === 'In Progress' ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'}`,
                                  }}
                                >
                                  {item.fai_status === 'Approved' ? '✓ Qualified' : item.fai_status === 'In Progress' ? '⚙ Trial Run' : item.fai_status === 'Rejected' ? '✗ Rejected' : '◎ Pending'}
                                </span>
                              </div>

                              {/* ── Row 2: Progress bar ── */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <span>FAI Progress</span>
                                  <span style={{ fontWeight: '600', color: progress === 100 ? 'var(--color-won)' : 'var(--color-follow)' }}>{progress}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    borderRadius: '4px',
                                    background: progress === 100 ? 'linear-gradient(90deg, var(--color-accent), var(--color-won))' : 'linear-gradient(90deg, var(--color-accent), var(--color-follow))',
                                    transition: 'width 0.4s ease'
                                  }} />
                                </div>
                              </div>

                              {/* ── Row 3: Milestone chips ── */}
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[
                                  { label: '📐 Dimensions', status: dimStatus },
                                  { label: '📄 Material Cert', status: matStatus },
                                  { label: '🔬 Test Report', status: testStatus },
                                ].map(({ label, status }) => (
                                  <span
                                    key={label}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '4px 10px',
                                      borderRadius: '20px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      border: `1px solid ${status === 'Passed' ? 'rgba(16,185,129,0.3)' : status === 'Failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                      background: status === 'Passed' ? 'rgba(16,185,129,0.1)' : status === 'Failed' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                                      color: status === 'Passed' ? 'var(--color-won)' : status === 'Failed' ? 'var(--color-stale)' : 'var(--text-muted)',
                                    }}
                                  >
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: status === 'Passed' ? 'var(--color-won)' : status === 'Failed' ? 'var(--color-stale)' : 'var(--border-color)', flexShrink: 0, display: 'inline-block' }} />
                                    {label}
                                  </span>
                                ))}
                              </div>

                              {/* ── Row 4: Date footer ── */}
                              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '11px' }}>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Ordered:</span>
                                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                    {item.inquiryDate ? new Date(item.inquiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Sign-off Target:</span>
                                  <span style={{ fontWeight: '600', color: item.fai_date ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                                    {item.fai_date ? new Date(item.fai_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
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
                        <option value="all">All Categories</option>
                        <option value="sand casting">Sand Casting</option>
                        <option value="fabrication">Fabrication</option>
                        <option value="investment">Investment Casting</option>
                        <option value="forging">Forging</option>
                        <option value="others">Others</option>
                      </select>

                      <select 
                        className="filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="Pending Quotation">Pending Quotation</option>
                        <option value="Submitted">Submitted</option>
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
                        {['AFIF NI', 'PUTRI', 'ERVAN', 'NOVY', 'RANU'].map(pic => (
                          <option key={pic} value={pic}>{pic}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {showOnlyPendingQuotes && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#60a5fa',
                      fontWeight: '500',
                      marginTop: '12px',
                      marginBottom: '16px'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏱️ Showing only inquiries with <strong>Pending Quotations</strong> (Not canceled, no quotation # submitted yet).
                      </span>
                      <button 
                        onClick={() => setShowOnlyPendingQuotes(false)} 
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          marginLeft: 'auto',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}

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
                            <th className="sortable-header" onClick={() => handleSort('inquiry_date')}>Inquiry Date {renderSortIcon('inquiry_date')}</th>
                            <th className="sortable-header" onClick={() => handleSort('customer')}>Customer {renderSortIcon('customer')}</th>
                            <th>Items</th>
                            <th>Type</th>
                            <th className="sortable-header" onClick={() => handleSort('quotation_number')}>Quot. # {renderSortIcon('quotation_number')}</th>
                            <th>Lead Time</th>
                            <th className="sortable-header" onClick={() => handleSort('value')}>Value {renderSortIcon('value')}</th>
                            <th className="sortable-header" onClick={() => handleSort('pic')}>PIC {renderSortIcon('pic')}</th>
                            <th className="sortable-header" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFilteredInquiries.map(inq => {
                            const isStaleItem = isStale(inq.last_activity_at) && inq.status !== 'PO Won' && inq.status !== 'Canceled';
                            return (
                              <tr key={inq.id} onClick={() => openInquiryDrawer(inq)}>
                                <td>{new Date(inq.inquiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td style={{ fontWeight: '600' }}>
                                  {isStaleItem && <span className="stale-pulse"></span>}
                                  {inq.customers?.company_name}
                                </td>
                                <td>
                                  <span className="item-count-badge">
                                    📦 {inq.inquiry_items?.length || 0} {inq.inquiry_items?.length === 1 ? 'Item' : 'Items'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                    {inq.category}
                                  </span>
                                </td>
                                <td style={{ color: inq.quotation_number ? 'inherit' : 'var(--color-pending)', fontWeight: inq.quotation_number ? 'normal' : '600' }}>
                                  {inq.quotation_number || 'Waiting Input'}
                                </td>
                                <td>
                                  {!inq.quotation_number && inq.status !== 'Canceled' ? (
                                    (() => {
                                      const openDays = getDaysOpen(inq.inquiry_date);
                                      return (
                                        <span style={{ color: 'var(--color-follow)', fontWeight: '600', fontSize: '13px' }}>
                                          ⏱️ {openDays} {openDays === 1 ? 'day' : 'days'} open
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    inq.lead_time_days ? `${inq.lead_time_days} days` : '-'
                                  )}
                                </td>
                                <td style={{ fontWeight: '600', color: 'var(--color-won)' }}>{getInquiryTotal(inq)}</td>
                                <td style={{ fontWeight: '500' }}>{inq.customers?.pic_name}</td>
                                <td>
                                  {isStaleItem ? (
                                    <span className="status-badge badge-stale">Stale Follow-up</span>
                                  ) : (
                                    (() => {
                                      const aggStatus = getAggregateStatus(inq);
                                      if (aggStatus === 'PO Won') return <span className="status-badge badge-won">PO Won</span>;
                                      if (aggStatus.startsWith('PO Won (')) return <span className="status-badge badge-partial-won">{aggStatus}</span>;
                                      if (aggStatus === 'Pending Quotation') return <span className="status-badge badge-pending">Pending Quotation</span>;
                                      if (aggStatus === 'Submitted') return <span className="status-badge badge-pending" style={{ color: 'var(--color-accent)', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'var(--color-accent-glow)' }}>Submitted</span>;
                                      if (aggStatus === 'Follow Up') return <span className="status-badge badge-follow">Follow Up</span>;
                                      if (aggStatus === 'Canceled') return <span className="status-badge badge-canceled">Canceled</span>;
                                      return null;
                                    })()
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
                                <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>Sales Owner: {cust.pic_name || 'Unassigned'}</span>
                              </div>
                              {cust.client_contact_person && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                                  <Users size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                  <span style={{ color: 'var(--text-muted)' }}>Client: <strong style={{ color: 'var(--text-main)', fontWeight: '500' }}>{cust.client_contact_person}</strong></span>
                                </div>
                              )}
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
            {/* Line Items Section */}
            <div className="form-group" style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span>Line Items</span>
                <span style={{ fontSize: '11px', textTransform: 'none', color: 'var(--text-muted)' }}>{(selectedInquiry.inquiry_items || []).length} item(s)</span>
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {(selectedInquiry.inquiry_items || []).map((item, index) => {
                  // Live calculations for display
                  const cast = parseFloat(item.cast_price) || 0;
                  const mach = parseFloat(item.mach_price) || 0;
                  const surf = parseFloat(item.surface_treatment) || 0;
                  const pack = parseFloat(item.packing_cost) || 0;
                  const cfrVal = parseFloat(item.cfr) || 0;
                  const quantity = parseInt(item.qty) || 0;
                  const liveTotalPerQty = cast + mach + surf + pack + cfrVal;
                  const liveTotalPrice = liveTotalPerQty * quantity;
                  
                  const isExpanded = item.showDetails;

                  return (
                    <div key={index} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-accent)' }}>Item #{index + 1}</span>
                        {(selectedInquiry.inquiry_items || []).length > 1 && (
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', color: 'var(--color-stale)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                            onClick={() => {
                              const updated = selectedInquiry.inquiry_items.filter((_, idx) => idx !== index);
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          >
                            <X size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Item / Product Name *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Pump Housing DN150" 
                            required
                            value={item.item_name || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].item_name = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Qty *</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Qty" 
                            required
                            min="1"
                            value={item.qty || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].qty = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Material</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. AISI 316" 
                            value={item.material || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].material = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Process</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Casting + Machining" 
                            value={item.process || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].process = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: '600' }}>Item Status</label>
                          <select 
                            className="form-select"
                            style={{ padding: '8px' }}
                            value={item.status || 'Pending Quotation'}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].status = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          >
                            <option value="Pending Quotation">Pending Quotation</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="PO Won">PO Won</option>
                            <option value="Canceled">Canceled</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            const updated = [...selectedInquiry.inquiry_items];
                            updated[index].showDetails = !updated[index].showDetails;
                            setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                          }}
                        >
                          {isExpanded ? 'Hide Financial Details ▲' : 'Show Financial Details ▼'}
                        </button>
                        
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--color-won)', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            const updated = [...selectedInquiry.inquiry_items];
                            updated[index].showFai = !updated[index].showFai;
                            setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                          }}
                        >
                          {item.showFai ? 'Hide First Article FAI ▲' : '🛠️ Product Eng First Article ▼'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tipe Proses</label>
                              <select 
                                className="form-select"
                                style={{ padding: '8px' }}
                                value={item.tipe_proses || ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].tipe_proses = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              >
                                <option value="">-- Select Type --</option>
                                <option value="SAND CASTING">Sand Casting</option>
                                <option value="FABRICATION">Fabrication</option>
                                <option value="INVESTMENT CASTING">Investment Casting</option>
                                <option value="FORGING">Forging</option>
                                <option value="others">Others</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tooling Cost</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '8px' }}
                                placeholder="0.00" 
                                value={item.tooling_cost ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].tooling_cost = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Cast Price</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.cast_price ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].cast_price = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Mach Price</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.mach_price ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].mach_price = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Surface Trt.</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.surface_treatment ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].surface_treatment = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Packing Cost</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.packing_cost ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].packing_cost = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>CFR</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.cfr ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].cfr = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', fontSize: '12px' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Total / Qty: </span>
                              <strong style={{ color: 'var(--text-main)' }}>{liveTotalPerQty.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Total Price: </span>
                              <strong style={{ color: 'var(--color-won)' }}>{liveTotalPrice.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {item.showFai && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px', padding: '16px', background: 'var(--color-won-glow)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.1)', paddingBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-won)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              First Article Inspection (FAI) Tracking
                            </span>
                            <span className="status-badge" style={{ 
                              background: item.fai_status === 'Approved' ? 'rgba(16, 185, 129, 0.2)' : item.fai_status === 'Rejected' ? 'rgba(239, 68, 68, 0.2)' : item.fai_status === 'In Progress' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: item.fai_status === 'Approved' ? 'var(--color-won)' : item.fai_status === 'Rejected' ? 'var(--color-stale)' : item.fai_status === 'In Progress' ? 'var(--color-follow)' : 'var(--text-muted)'
                            }}>
                              {item.fai_status || 'Pending'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px', color: 'var(--color-won)', textTransform: 'none' }}>FAI Status</label>
                              <select 
                                className="form-select"
                                style={{ padding: '8px' }}
                                value={item.fai_status || 'Pending'}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_status = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              >
                                <option value="Pending">Pending Review</option>
                                <option value="In Progress">In Progress / Trial</option>
                                <option value="Approved">Approved / Qualified</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px', color: 'var(--color-won)', textTransform: 'none' }}>Responsible Engineer</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ padding: '8px' }}
                                placeholder="e.g. PUTRI" 
                                value={item.fai_engineer || ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_engineer = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px', textTransform: 'none' }}>Dimensions Check</label>
                              <select 
                                className="form-select"
                                style={{ padding: '6px', fontSize: '12px' }}
                                value={item.fai_dimensions || 'Pending'}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_dimensions = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px', textTransform: 'none' }}>Material Cert</label>
                              <select 
                                className="form-select"
                                style={{ padding: '6px', fontSize: '12px' }}
                                value={item.fai_material_cert || 'Pending'}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_material_cert = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px', textTransform: 'none' }}>Testing Report</label>
                              <select 
                                className="form-select"
                                style={{ padding: '6px', fontSize: '12px' }}
                                value={item.fai_test_report || 'Pending'}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_test_report = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px', textTransform: 'none' }}>Remarks / Tolerance Notes</label>
                              <textarea 
                                className="form-textarea" 
                                style={{ minHeight: '60px', padding: '8px', fontSize: '13px' }}
                                placeholder="Note dimensional deviations or test parameters..." 
                                value={item.fai_remarks || ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_remarks = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px', textTransform: 'none' }}>Sign-off Date</label>
                              <input 
                                type="date" 
                                className="form-input" 
                                style={{ padding: '8px', fontSize: '13px' }}
                                value={item.fai_date || ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_date = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Drawings Section (existing items only) ── */}
                      {item.id && (
                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-pending)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              📎 Drawings
                              {(itemDrawings[item.id] || []).length > 0 && (
                                <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--color-pending)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px' }}>
                                  {(itemDrawings[item.id] || []).length}
                                </span>
                              )}
                            </span>
                            <label
                              htmlFor={`drawing-upload-${item.id}`}
                              style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', background: 'rgba(139,92,246,0.06)' }}
                            >
                              + Upload PDF
                              <input
                                id={`drawing-upload-${item.id}`}
                                type="file"
                                accept="application/pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files[0]) handleDrawingUpload(item.id, e.target.files[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>

                          {drawingsLoading ? (
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading drawings…</p>
                          ) : (itemDrawings[item.id] || []).length === 0 ? (
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No drawings uploaded yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(itemDrawings[item.id] || []).map((drawing) => (
                                <div key={drawing.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: 0 }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>📄 {drawing.file_name}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(drawing.uploaded_at).toLocaleDateString()}</span>
                                  <button type="button" onClick={() => openDrawingViewer(drawing)}
                                    style={{ background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', color: 'var(--color-pending)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', padding: '3px 8px', flexShrink: 0 }}>
                                    View
                                  </button>
                                  <button type="button" onClick={() => handleDrawingDelete(drawing, item.id)}
                                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--color-stale)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', padding: '3px 8px', flexShrink: 0 }}>
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button 
                type="button" 
                className="action-btn"
                style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px', alignSelf: 'flex-start' }}
                onClick={() => {
                  const updated = [...(selectedInquiry.inquiry_items || [])];
                  updated.push({
                    item_name: '',
                    material: '',
                    process: '',
                    tipe_proses: '',
                    qty: 1,
                    cast_price: '',
                    mach_price: '',
                    surface_treatment: '',
                    packing_cost: '',
                    cfr: '',
                    tooling_cost: '',
                    showDetails: false
                  });
                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                }}
              >
                <Plus size={16} /> Add Line Item
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Category Type</label>
              <select 
                className="form-select"
                value={selectedInquiry.category}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, category: e.target.value })}
              >
                <option value="others">Others</option>
                <option value="sand casting">Sand Casting</option>
                <option value="fabrication">Fabrication</option>
                <option value="investment">Investment Casting</option>
                <option value="forging">Forging</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Inquiry Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={selectedInquiry.inquiry_date || ''}
                disabled 
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Client Contact Person</label>
              <textarea 
                className="form-textarea" 
                value={selectedInquiry.customers?.client_contact_person || 'No contact person registered'}
                disabled 
                style={{ opacity: 0.7, cursor: 'not-allowed', minHeight: '60px' }}
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
              <label className="form-label">Currency</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[{ value: 'USD', label: '🇺🇸 USD', sub: 'US Dollar' }, { value: 'IDR', label: '🇮🇩 IDR', sub: 'Rupiah' }, { value: 'EUR', label: '🇪🇺 EUR', sub: 'Euro' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedInquiry({ ...selectedInquiry, currency: opt.value })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: `2px solid ${(selectedInquiry.currency || 'USD') === opt.value ? 'var(--color-accent)' : 'var(--border-color)'}`,
                      background: (selectedInquiry.currency || 'USD') === opt.value ? 'rgba(139,92,246,0.12)' : 'var(--input-bg)',
                      color: (selectedInquiry.currency || 'USD') === opt.value ? 'var(--color-accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: '700',
                      fontSize: '13px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                    <span style={{ fontSize: '10px', fontWeight: '400', opacity: 0.7 }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quotation Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={selectedInquiry.quotation_date || ''}
                onChange={e => {
                  const qDate = e.target.value;
                  const calculatedLead = calculateWorkingDays(selectedInquiry.inquiry_date, qDate);
                  setSelectedInquiry({ 
                    ...selectedInquiry, 
                    quotation_date: qDate,
                    lead_time_days: calculatedLead
                  });
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Lead Time (Working Days)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Calculated automatically from Quotation Date" 
                disabled
                style={{ cursor: 'not-allowed', opacity: 0.6, background: 'rgba(255,255,255,0.02)' }}
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
                <option value="Submitted">Submitted</option>
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
                <option value="others">Others</option>
                <option value="sand casting">Sand Casting</option>
                <option value="fabrication">Fabrication</option>
                <option value="investment">Investment Casting</option>
                <option value="forging">Forging</option>
              </select>
            </div>

            {/* Line Items Section */}
            <div className="form-group" style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span>Line Items</span>
                <span style={{ fontSize: '11px', textTransform: 'none', color: 'var(--text-muted)' }}>{newInquiry.items.length} item(s)</span>
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {newInquiry.items.map((item, index) => {
                  // Live calculations for display
                  const cast = parseFloat(item.cast_price) || 0;
                  const mach = parseFloat(item.mach_price) || 0;
                  const surf = parseFloat(item.surface_treatment) || 0;
                  const pack = parseFloat(item.packing_cost) || 0;
                  const cfrVal = parseFloat(item.cfr) || 0;
                  const quantity = parseInt(item.qty) || 0;
                  const liveTotalPerQty = cast + mach + surf + pack + cfrVal;
                  const liveTotalPrice = liveTotalPerQty * quantity;
                  
                  const isExpanded = item.showDetails;

                  return (
                    <div key={index} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-accent)' }}>Item #{index + 1}</span>
                        {newInquiry.items.length > 1 && (
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', color: 'var(--color-stale)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                            onClick={() => {
                              const updated = newInquiry.items.filter((_, idx) => idx !== index);
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          >
                            <X size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Item / Product Name *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Pump Housing DN150" 
                            required
                            value={item.item_name}
                            onChange={e => {
                              const updated = [...newInquiry.items];
                              updated[index].item_name = e.target.value;
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Qty *</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Qty" 
                            required
                            min="1"
                            value={item.qty}
                            onChange={e => {
                              const updated = [...newInquiry.items];
                              updated[index].qty = e.target.value;
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Material</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. AISI 316" 
                            value={item.material || ''}
                            onChange={e => {
                              const updated = [...newInquiry.items];
                              updated[index].material = e.target.value;
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Process</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Casting + Machining" 
                            value={item.process || ''}
                            onChange={e => {
                              const updated = [...newInquiry.items];
                              updated[index].process = e.target.value;
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            const updated = [...newInquiry.items];
                            updated[index].showDetails = !updated[index].showDetails;
                            setNewInquiry({ ...newInquiry, items: updated });
                          }}
                        >
                          {isExpanded ? 'Hide Financial Details ▲' : 'Show Financial Details ▼'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tipe Proses</label>
                              <select 
                                className="form-select"
                                style={{ padding: '8px' }}
                                value={item.tipe_proses || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].tipe_proses = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              >
                                <option value="">-- Select Type --</option>
                                <option value="SAND CASTING">Sand Casting</option>
                                <option value="FABRICATION">Fabrication</option>
                                <option value="INVESTMENT CASTING">Investment Casting</option>
                                <option value="FORGING">Forging</option>
                                <option value="others">Others</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tooling Cost</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '8px' }}
                                placeholder="0.00" 
                                value={item.tooling_cost || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].tooling_cost = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Cast Price</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.cast_price || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].cast_price = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Mach Price</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.mach_price || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].mach_price = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Surface Trt.</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.surface_treatment || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].surface_treatment = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>Packing Cost</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.packing_cost || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].packing_cost = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '9px' }}>CFR</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px' }}
                                placeholder="0" 
                                value={item.cfr || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].cfr = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', fontSize: '12px' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Total / Qty: </span>
                              <strong style={{ color: 'var(--text-main)' }}>{liveTotalPerQty.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Total Price: </span>
                              <strong style={{ color: 'var(--color-won)' }}>{liveTotalPrice.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button 
                type="button" 
                className="action-btn"
                style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px', alignSelf: 'flex-start' }}
                onClick={() => {
                  const updated = [...newInquiry.items];
                  updated.push({
                    item_name: '',
                    material: '',
                    process: '',
                    tipe_proses: '',
                    qty: 1,
                    cast_price: '',
                    mach_price: '',
                    surface_treatment: '',
                    packing_cost: '',
                    cfr: '',
                    tooling_cost: '',
                    showDetails: false
                  });
                  setNewInquiry({ ...newInquiry, items: updated });
                }}
              >
                <Plus size={16} /> Add Line Item
              </button>
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
              <label className="form-label">Currency</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[{ value: 'USD', label: '🇺🇸 USD', sub: 'US Dollar' }, { value: 'IDR', label: '🇮🇩 IDR', sub: 'Rupiah' }, { value: 'EUR', label: '🇪🇺 EUR', sub: 'Euro' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewInquiry({ ...newInquiry, currency: opt.value })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: `2px solid ${(newInquiry.currency || 'USD') === opt.value ? 'var(--color-accent)' : 'var(--border-color)'}`,
                      background: (newInquiry.currency || 'USD') === opt.value ? 'rgba(139,92,246,0.12)' : 'var(--input-bg)',
                      color: (newInquiry.currency || 'USD') === opt.value ? 'var(--color-accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: '700',
                      fontSize: '13px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                    <span style={{ fontSize: '10px', fontWeight: '400', opacity: 0.7 }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
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
              <label className="form-label">Client Contact Person</label>
              <textarea 
                className="form-textarea" 
                placeholder="e.g. Pak Wafi, +62 812..." 
                value={newCustomer.client_contact_person || ''}
                onChange={e => setNewCustomer({ ...newCustomer, client_contact_person: e.target.value })}
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

      {/* ── PDF DRAWING VIEWER MODAL ── */}
      {viewerDrawing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}
          onClick={e => { if (e.target === e.currentTarget) closeDrawingViewer(); }}
        >
          {/* Header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', flexShrink: 0, gap: '16px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              📄 {viewerDrawing.file_name}
            </span>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              {viewerUrl && (
                <a href={viewerUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-accent)', textDecoration: 'none', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '6px 14px' }}>
                  ↓ Download
                </a>
              )}
              <button onClick={closeDrawingViewer}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 14px', fontSize: '20px', lineHeight: 1 }}>
                ×
              </button>
            </div>
          </div>

          {/* Viewer body */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', minHeight: 0 }}>
            {viewerLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Loading drawing…
              </div>
            ) : viewerUrl ? (
              <iframe src={viewerUrl} title={viewerDrawing.file_name}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#fff' }} />
            ) : (
              <p style={{ color: 'var(--color-stale)' }}>Failed to load drawing.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
