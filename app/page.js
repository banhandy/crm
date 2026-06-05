'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from 'next-themes';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
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
  const [drawerMode, setDrawerMode] = useState('view'); // 'view' or 'edit'
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

  // Toggle Theme helper
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
    const aggStatus = getAggregateStatus({ ...inq, inquiry_items: items });
    const normalizedStatus = aggStatus.startsWith('PO Won (') ? 'PO Won' : aggStatus;
    setSelectedInquiry({ 
      ...inq, 
      status: normalizedStatus,
      inquiry_items: items 
    });
    setDrawerMode('view'); // Always default to view-only mode for review meetings!
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
      <div className="flex items-center justify-center w-screen h-screen bg-background transition-colors duration-300">
        <div className="w-[420px] p-10 rounded-2xl border border-border bg-card shadow-2xl flex flex-col gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-pending rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              C
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">CRM Core Portal</h2>
            <p className="text-xs text-muted mt-1.5 uppercase tracking-wider font-semibold">Admin-Managed Access Portal</p>
          </div>

          <form onSubmit={handleSignIn} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Workplace Email</label>
              <Input 
                type="email" 
                required 
                placeholder="administrator@company.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Password</label>
              <Input 
                type="password" 
                required 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-stale/10 border border-stale/20 text-stale text-xs">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full flex justify-center py-2 text-sm"
              disabled={authActionLoading}
            >
              {authActionLoading ? 'Authenticating...' : 'Sign In To Workspace'}
            </Button>
          </form>

          <div className="border-t border-border pt-4 text-center flex justify-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              Toggle Theme
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER WORKSPACE (If authenticated)
  // ----------------------------------------------------
  const renderSortIcon = (field) => {
    if (sortField !== field) return <span className="ml-1.5 opacity-35 text-[11px] inline-block transition-all duration-200">⇅</span>;
    return <span className="ml-1.5 text-primary text-[11px] inline-block transition-all duration-200">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      {/* 1. SIDEBAR NAVIGATION */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" 
          onClick={() => setMobileSidebarOpen(false)} 
        />
      )}
      <aside className={`flex h-full flex-col justify-between border-r border-border bg-sidebar py-6 transition-all duration-300 z-55 shrink-0 ${sidebarCollapsed ? 'w-20 px-3' : 'w-64 px-4'} ${mobileSidebarOpen ? 'fixed inset-y-0 left-0 translate-x-0 w-64' : 'hidden md:flex'}`}>
        <div>
          <div className={`flex items-center justify-between pb-6 border-b border-border ${sidebarCollapsed ? 'px-0 justify-center' : 'px-3'}`}>
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-pending text-white font-bold text-lg shrink-0">C</div>
              {!sidebarCollapsed && <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted bg-clip-text text-transparent">CRM Core</span>}
            </div>
            {!sidebarCollapsed && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSidebarCollapsed(true)}
                className="text-muted hover:text-foreground shrink-0"
                title="Collapse Sidebar"
              >
                <Menu size={18} />
              </Button>
            )}
          </div>

          {sidebarCollapsed && (
            <div className="flex justify-center py-4 border-b border-border mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                className="text-muted hover:text-foreground"
                title="Expand Sidebar"
              >
                <Menu size={18} />
              </Button>
            </div>
          )}

          <nav className="flex flex-col gap-1.5 mt-6">
            {[
              { id: 'dashboard', name: 'Dashboard Analytics', icon: LayoutDashboard },
              { id: 'inquiries', name: 'Inquiries Pipeline', icon: FileText },
              { id: 'customers', name: 'Customer Contact', icon: Users },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div 
                  key={tab.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium ${sidebarCollapsed ? 'justify-center' : 'justify-start'} ${isActive ? 'text-foreground bg-primary/10 border-l-4 border-primary pl-2' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
                  onClick={() => { setActiveTab(tab.id); setMobileSidebarOpen(false); }}
                  title={sidebarCollapsed ? tab.name : ""}
                >
                  <Icon size={20} className="shrink-0" />
                  {!sidebarCollapsed && <span>{tab.name}</span>}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t border-border">
          <Button 
            variant="outline" 
            onClick={toggleTheme}
            title={sidebarCollapsed ? "Toggle Theme" : ""}
            className={`w-full justify-start gap-3 border-border hover:bg-card-hover text-foreground ${sidebarCollapsed ? 'px-0 justify-center' : ''}`}
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSignOut} 
            title={sidebarCollapsed ? "Sign Out" : ""}
            className={`w-full justify-start gap-3 border-red-500/20 text-red-500 hover:bg-red-500/10 ${sidebarCollapsed ? 'px-0 justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </Button>
          <div className={`flex items-center gap-3 mt-2 ${sidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-white shrink-0">
              {session.user.email[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate w-32">{session.user.email}</p>
                <p className="text-[11px] text-muted">Authorized</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-border z-40 flex items-center justify-around md:hidden">
        {[
          { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
          { id: 'inquiries', name: 'Pipeline', icon: FileText },
          { id: 'customers', name: 'Contact', icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium transition-all ${
                isActive ? 'text-primary font-semibold' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : 'text-muted'} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 h-screen">
        <header className="flex h-18 items-center justify-between border-b border-border bg-sidebar/55 backdrop-blur-md px-8 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              className="hidden text-foreground"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              {activeTab === 'dashboard' && '📊 Dashboard Analytics'}
              {activeTab === 'inquiries' && '📁 Inquiries Pipeline'}
              {activeTab === 'customers' && '👥 Customer Directory'}
            </h1>
          </div>
          <div className="flex gap-3">
            {activeTab === 'customers' && (
              <Button onClick={() => setIsAddCustomerOpen(true)} className="flex items-center gap-2">
                <Plus size={16} /> Add Customer
              </Button>
            )}
            <Button onClick={() => setIsAddInquiryOpen(true)} className="flex items-center gap-2">
              <Plus size={16} /> New Inquiry
            </Button>
          </div>
        </header>

        <div className="flex-1 p-8 pb-24 md:pb-8 overflow-y-auto overflow-x-hidden flex flex-col gap-8 box-border w-full">
          {/* A. KPI BANNER RIBBON */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 sticky top-[-32px] z-30 bg-background/90 backdrop-blur-md py-4 -my-4 border-b border-border/10">
            <Card className="p-5 flex flex-col gap-2 relative border-l-4 border-l-primary bg-card/60 backdrop-blur-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Inquiries</span>
              <div className="text-2xl font-bold flex items-baseline gap-1.5 text-foreground">
                {totalInquiries}
                <span className="text-[11px] text-muted font-normal uppercase">requests</span>
              </div>
            </Card>

            <Card 
              className={`p-5 flex flex-col gap-2 relative border-l-4 border-l-pending bg-card/60 backdrop-blur-md cursor-pointer hover:bg-card-hover/40 transition-all duration-200 ${showOnlyPendingQuotes ? 'ring-1 ring-pending' : ''}`}
              onClick={() => {
                setShowOnlyPendingQuotes(prev => !prev);
                if (activeTab !== 'inquiries') {
                  setActiveTab('inquiries');
                }
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Inquiries Without Quote</span>
              <div className="text-2xl font-bold flex items-baseline gap-1.5 text-pending">
                {pendingQuotations}
                <span className="text-[11px] text-muted font-normal uppercase">pending</span>
              </div>
            </Card>

            <Card className="p-5 flex flex-col gap-2 relative border-l-4 border-l-follow bg-card/60 backdrop-blur-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Active Follow-up</span>
              <div className="text-2xl font-bold flex items-baseline gap-1.5 text-follow">
                {followUpCount}
                <span className="text-[11px] text-muted font-normal uppercase">leads</span>
              </div>
            </Card>

            <Card className="p-5 flex flex-col gap-2 relative border-l-4 border-l-stale bg-card/60 backdrop-blur-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Stale Follow-up (3d+)</span>
              <div className="text-2xl font-bold flex items-center text-stale">
                {staleCount}
                {staleCount > 0 && <span className="stale-pulse w-2.5 h-2.5 rounded-full bg-stale inline-block ml-3 animate-pulse"></span>}
              </div>
            </Card>

            <Card className="p-5 flex flex-col gap-2 relative border-l-4 border-l-won bg-card/60 backdrop-blur-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Won Conversion</span>
              <div className="text-2xl font-bold flex items-baseline gap-1.5 text-won">
                {conversionRate}%
                <span className="text-[11px] text-muted font-normal normal-case">({wonOrdersCount} POs)</span>
              </div>
            </Card>
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
                        <span className="kpi-title">Inquiries Without Quote</span>
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
                        ⏱️ Showing only <strong>Inquiries Without Quote</strong> (Not canceled, no quotation # submitted yet).
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

                  {/* DATA TABLE / CARDS */}
                  {filteredInquiries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={40} style={{ marginBottom: '12px' }} />
                      <p style={{ fontWeight: '500' }}>No inquiries match your filters.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="table-container hidden md:block">
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

                      {/* Mobile Cards View */}
                      <div className="flex flex-col gap-4 md:hidden">
                        {sortedFilteredInquiries.map(inq => {
                          const isStaleItem = isStale(inq.last_activity_at) && inq.status !== 'PO Won' && inq.status !== 'Canceled';
                          const aggStatus = isStaleItem ? 'Stale Follow-up' : getAggregateStatus(inq);
                          return (
                            <div 
                              key={inq.id} 
                              onClick={() => openInquiryDrawer(inq)}
                              className="bg-card border border-border p-4 rounded-xl flex flex-col gap-3 hover:bg-card-hover/40 transition-all cursor-pointer relative"
                            >
                              {/* Header: Date + Status */}
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted">
                                  {new Date(inq.inquiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {(() => {
                                  if (aggStatus === 'PO Won') return <Badge variant="won">PO Won</Badge>;
                                  if (aggStatus.startsWith('PO Won (')) return <Badge variant="won">{aggStatus}</Badge>;
                                  if (aggStatus === 'Pending Quotation') return <Badge variant="pending">Pending Quotation</Badge>;
                                  if (aggStatus === 'Submitted') return <Badge variant="pending" className="border-primary bg-primary/10 text-primary">Submitted</Badge>;
                                  if (aggStatus === 'Follow Up') return <Badge variant="follow">Follow Up</Badge>;
                                  if (aggStatus === 'Canceled') return <Badge variant="outline" className="text-muted/65 border-muted/20">Canceled</Badge>;
                                  if (aggStatus === 'Stale Follow-up') return <Badge variant="stale">Stale Follow-up</Badge>;
                                  return <Badge variant="pending">{aggStatus}</Badge>;
                                })()}
                              </div>

                              {/* Title: Company name */}
                              <div className="text-base font-bold text-foreground flex items-center gap-2">
                                {isStaleItem && <span className="stale-pulse shrink-0"></span>}
                                <span className="truncate">{inq.customers?.company_name}</span>
                              </div>

                              {/* Footer: Item count + value/lead indicator */}
                              <div className="flex justify-between items-center text-xs text-muted">
                                <span className="flex items-center gap-1.5">
                                  📦 {inq.inquiry_items?.length || 0} {inq.inquiry_items?.length === 1 ? 'Item' : 'Items'}
                                </span>
                                <span className="font-semibold text-won">
                                  {getInquiryTotal(inq)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Floating Action Button (FAB) on Mobile */}
                      <Button 
                        onClick={() => setIsAddInquiryOpen(true)}
                        className="fixed bottom-20 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-45 md:hidden hover:scale-105 transition-all"
                        size="icon"
                      >
                        <Plus size={24} />
                      </Button>
                    </>
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
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
      />
      <div className={`fixed top-0 right-0 bottom-0 w-full sm:w-[600px] md:w-[66vw] max-w-[950px] bg-sidebar border-l border-border shadow-2xl z-[1001] transition-transform duration-300 ease-in-out flex flex-col p-6 md:p-8 overflow-x-hidden ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="border-b border-border pb-4 mb-6 flex flex-col gap-3 items-stretch shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                {drawerMode === 'view' ? '📋 Inquiry Review' : '✏️ Edit Inquiry Details'}
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                🏢 {selectedInquiry?.customers?.company_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Premium Switcher Tab Segment */}
              {selectedInquiry && (
                <div className="flex bg-card/40 border border-border rounded-lg p-1 mr-2">
                  <button
                    type="button"
                    onClick={() => setDrawerMode('view')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      drawerMode === 'view'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted hover:text-foreground bg-transparent'
                    }`}
                  >
                    👁️ View Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerMode('edit')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      drawerMode === 'edit'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted hover:text-foreground bg-transparent'
                    }`}
                  >
                    ✏️ Edit Mode
                  </button>
                </div>
              )}
              <button 
                type="button"
                className="bg-card/45 hover:bg-card-hover border border-border rounded-full w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-all cursor-pointer"
                onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {selectedInquiry && drawerMode === 'edit' && (
          <form className="flex-grow overflow-y-auto overflow-x-hidden flex flex-col gap-5 w-full pr-1" onSubmit={handleUpdateInquiry}>
            {/* Line Items Section */}
            <div className="flex flex-col gap-2 min-w-0 mt-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted flex justify-between border-b border-border pb-1.5">
                <span>Line Items</span>
                <span className="normal-case font-normal">{(selectedInquiry.inquiry_items || []).length} item(s)</span>
              </label>
              
              <div className="flex flex-col gap-4 mt-3">
                {(selectedInquiry.inquiry_items || []).map((item, index) => {
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
                    <div key={index} className="bg-background/25 p-4 rounded-xl border border-border flex flex-col gap-3 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary">Item #{index + 1}</span>
                        {(selectedInquiry.inquiry_items || []).length > 1 && (
                          <button 
                            type="button" 
                            className="bg-transparent border-none text-stale hover:text-stale/80 cursor-pointer flex items-center gap-1 text-xs"
                            onClick={() => {
                              const updated = selectedInquiry.inquiry_items.filter((_, idx) => idx !== index);
                              const newParentStatus = getAggregateStatus({ ...selectedInquiry, inquiry_items: updated });
                              setSelectedInquiry({ 
                                ...selectedInquiry, 
                                status: newParentStatus,
                                inquiry_items: updated 
                              });
                            }}
                          >
                            <X size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[2fr_1fr] gap-3">
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Item / Product Name *</label>
                          <Input 
                            type="text" 
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
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Qty *</label>
                          <Input 
                            type="number" 
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

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Material</label>
                          <Input 
                            type="text" 
                            placeholder="e.g. AISI 316" 
                            value={item.material || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].material = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Process</label>
                          <Input 
                            type="text" 
                            placeholder="e.g. Casting + Machining" 
                            value={item.process || ''}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].process = e.target.value;
                              setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-primary font-bold">Item Status</label>
                          <Select 
                            value={item.status || 'Pending Quotation'}
                            onChange={e => {
                              const updated = [...selectedInquiry.inquiry_items];
                              updated[index].status = e.target.value;
                              const newParentStatus = getAggregateStatus({ ...selectedInquiry, inquiry_items: updated });
                              setSelectedInquiry({ 
                                ...selectedInquiry, 
                                status: newParentStatus,
                                inquiry_items: updated 
                              });
                            }}
                          >
                            <option value="Pending Quotation">Pending Quotation</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="PO Won">PO Won</option>
                            <option value="Canceled">Canceled</option>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-4 border-t border-dashed border-border pt-2.5 mt-1">
                        <button
                          type="button"
                          className="bg-transparent border-none text-primary hover:text-primary/80 cursor-pointer font-semibold text-xs flex items-center gap-1"
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
                          className="bg-transparent border-none text-won hover:text-won/80 cursor-pointer font-semibold text-xs flex items-center gap-1"
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
                        <div className="flex flex-col gap-3 mt-1.5 p-3 bg-background/10 rounded-lg border border-border/20">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Tipe Proses</label>
                              <Select 
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
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Tooling Cost</label>
                              <Input 
                                type="number" 
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

                          <div className="grid grid-cols-5 gap-1.5">
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Cast Price</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.cast_price ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].cast_price = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Mach Price</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.mach_price ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].mach_price = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Surface Trt.</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.surface_treatment ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].surface_treatment = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Packing Cost</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.packing_cost ?? ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].packing_cost = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">CFR</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
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

                          <div className="flex justify-between border-t border-border/40 pt-2 text-xs">
                            <div>
                              <span className="text-muted">Total / Qty: </span>
                              <strong className="text-foreground">{liveTotalPerQty.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-muted">Total Price: </span>
                              <strong className="text-won">{liveTotalPrice.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {item.showFai && (
                        <div className="flex flex-col gap-3 mt-1.5 p-4 bg-won/10 rounded-xl border border-won/20">
                          <div className="flex justify-between items-center border-b border-won/10 pb-2">
                            <span className="text-sm font-bold text-won flex items-center gap-1.5">
                              First Article Inspection (FAI) Tracking
                            </span>
                            <Badge variant="won">{item.fai_status || 'Pending'}</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] font-semibold text-won">FAI Status</label>
                              <Select 
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
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] font-semibold text-won">Responsible Engineer</label>
                              <Input 
                                type="text" 
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

                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[10px] text-muted">Dimensions Check</label>
                              <Select 
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
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[10px] text-muted">Material Cert</label>
                              <Select 
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
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[10px] text-muted">Testing Report</label>
                              <Select 
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
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-[2fr_1fr] gap-3">
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] text-muted">Remarks / Tolerance Notes</label>
                              <textarea 
                                className="flex min-h-[60px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                                placeholder="Note dimensional deviations or test parameters..." 
                                value={item.fai_remarks || ''}
                                onChange={e => {
                                  const updated = [...selectedInquiry.inquiry_items];
                                  updated[index].fai_remarks = e.target.value;
                                  setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] text-muted">Sign-off Date</label>
                              <Input 
                                type="date" 
                                className="text-xs"
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
                        <div className="border-t border-dashed border-border pt-3 mt-1 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-pending flex items-center gap-1.5">
                              📎 Drawings
                              {(itemDrawings[item.id] || []).length > 0 && (
                                <Badge variant="pending" className="px-1.5 py-0.2 text-[10px]">
                                  {(itemDrawings[item.id] || []).length}
                                </Badge>
                              )}
                            </span>
                            <label
                              htmlFor={`drawing-upload-${item.id}`}
                              className="text-xs font-semibold text-primary border border-primary/30 hover:border-primary/50 hover:bg-primary/5 rounded-lg py-1 px-3 transition-all duration-150 cursor-pointer"
                            >
                              + Upload PDF
                              <input
                                id={`drawing-upload-${item.id}`}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={e => {
                                  if (e.target.files[0]) handleDrawingUpload(item.id, e.target.files[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>

                          {drawingsLoading ? (
                            <p className="text-xs text-muted">Loading drawings…</p>
                          ) : (itemDrawings[item.id] || []).length === 0 ? (
                            <p className="text-xs text-muted italic">No drawings uploaded yet.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {(itemDrawings[item.id] || []).map((drawing) => (
                                <div key={drawing.id} className="flex items-center gap-2 p-2 bg-background/20 rounded-lg border border-border min-w-0">
                                  <span className="text-xs text-foreground truncate flex-1 min-w-0">📄 {drawing.file_name}</span>
                                  <span className="text-[10px] text-muted shrink-0">{new Date(drawing.uploaded_at).toLocaleDateString()}</span>
                                  <Button 
                                    type="button" 
                                    onClick={() => openDrawingViewer(drawing)}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs text-primary border-primary/20 hover:border-primary/40"
                                  >
                                    View
                                  </Button>
                                  <Button 
                                    type="button" 
                                    onClick={() => handleDrawingDelete(drawing, item.id)}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs text-stale border-stale/20 hover:border-stale/45 hover:bg-stale/5"
                                  >
                                    ✕
                                  </Button>
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

              <Button 
                type="button" 
                variant="secondary"
                size="sm"
                className="mt-3 self-start border border-border"
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
                    status: 'Pending Quotation',
                    showDetails: false
                  });
                  const newParentStatus = getAggregateStatus({ ...selectedInquiry, inquiry_items: updated });
                  setSelectedInquiry({ 
                    ...selectedInquiry, 
                    status: newParentStatus, 
                    inquiry_items: updated 
                  });
                }}
              >
                <Plus size={14} /> Add Line Item
              </Button>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Category Type</label>
              <Select 
                value={selectedInquiry.category}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, category: e.target.value })}
              >
                <option value="others">Others</option>
                <option value="sand casting">Sand Casting</option>
                <option value="fabrication">Fabrication</option>
                <option value="investment">Investment Casting</option>
                <option value="forging">Forging</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Inquiry Date</label>
              <Input 
                type="date" 
                value={selectedInquiry.inquiry_date || ''}
                disabled 
                className="opacity-60 cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Client Contact Person</label>
              <textarea 
                className="flex min-h-[60px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground opacity-70 cursor-not-allowed resize-none"
                value={selectedInquiry.customers?.client_contact_person || 'No contact person registered'}
                disabled 
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-pending flex justify-between">
                <span>Quotation Number</span> 
                {!selectedInquiry.quotation_number && <span className="text-[10px] font-normal normal-case">⚠️ Missing input</span>}
              </label>
              <Input 
                type="text" 
                placeholder="Enter quotation # (e.g. Q-2026-0099)" 
                value={selectedInquiry.quotation_number || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, quotation_number: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Currency</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: 'USD', label: '🇺🇸 USD', sub: 'US Dollar' }, { value: 'IDR', label: '🇮🇩 IDR', sub: 'Rupiah' }, { value: 'EUR', label: '🇪🇺 EUR', sub: 'Euro' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedInquiry({ ...selectedInquiry, currency: opt.value })}
                    className={`p-2.5 rounded-lg border-2 flex flex-col items-center gap-0.5 font-bold text-xs transition-all duration-150 cursor-pointer ${
                      (selectedInquiry.currency || 'USD') === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-input text-muted hover:border-border/80 hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                    <span className="text-[9px] font-normal opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Quotation Date</label>
              <Input 
                type="date" 
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

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Lead Time (Working Days)</label>
              <Input 
                type="number" 
                placeholder="Calculated automatically from Quotation Date" 
                disabled
                className="cursor-not-allowed opacity-60 bg-background/10"
                value={selectedInquiry.lead_time_days || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, lead_time_days: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Inquiry Status</label>
              <Select 
                value={selectedInquiry.status}
                onChange={e => {
                  const newStatus = e.target.value;
                  const updatedItems = (selectedInquiry.inquiry_items || []).map(item => ({
                    ...item,
                    status: newStatus
                  }));
                  setSelectedInquiry({ 
                    ...selectedInquiry, 
                    status: newStatus,
                    inquiry_items: updatedItems
                  });
                }}
              >
                <option value="Pending Quotation">Pending Quotation</option>
                <option value="Submitted">Submitted</option>
                <option value="Follow Up">Follow Up</option>
                <option value="PO Won">PO Won</option>
                <option value="Canceled">Canceled</option>
              </Select>
            </div>

            {selectedInquiry.status === 'PO Won' && (
              <>
                <div className="flex flex-col gap-2 min-w-0">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Purchase Order (PO) Number</label>
                  <Input 
                    type="text" 
                    placeholder="Enter PO # (e.g. PO-889922)" 
                    value={selectedInquiry.po_number || ''}
                    onChange={e => setSelectedInquiry({ ...selectedInquiry, po_number: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2 min-w-0">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Order Review Notes</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                    placeholder="Enter details about PO alignment review..." 
                    value={selectedInquiry.order_review || ''}
                    onChange={e => setSelectedInquiry({ ...selectedInquiry, order_review: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Follow-up Remarks / Notes</label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                placeholder="Add latest activities or conversation notes..." 
                value={selectedInquiry.remark || ''}
                onChange={e => setSelectedInquiry({ ...selectedInquiry, remark: e.target.value })}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-border flex gap-3 shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-11"
                onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-primary text-white h-11 hover:bg-primary/95">
                Save Updates
              </Button>
            </div>
          </form>
        )}

        {selectedInquiry && drawerMode === 'view' && (
          <div className="flex-grow overflow-y-auto overflow-x-hidden flex flex-col gap-5 w-full pr-1">
            {/* Overview Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/25 border border-border rounded-xl p-3 flex flex-col gap-2">
                <span className="text-[10px] uppercase text-muted font-bold">Inquiry Status</span>
                <div>
                  {(() => {
                    const aggStatus = getAggregateStatus(selectedInquiry);
                    if (aggStatus === 'PO Won') return <Badge variant="won">PO Won</Badge>;
                    if (aggStatus.startsWith('PO Won (')) return <Badge variant="won">{aggStatus}</Badge>;
                    if (aggStatus === 'Pending Quotation') return <Badge variant="pending">Pending Quotation</Badge>;
                    if (aggStatus === 'Submitted') return <Badge variant="pending" className="border-primary bg-primary/10 text-primary">Submitted</Badge>;
                    if (aggStatus === 'Follow Up') return <Badge variant="follow">Follow Up</Badge>;
                    if (aggStatus === 'Canceled') return <Badge variant="outline" className="text-muted/65 border-muted/20">Canceled</Badge>;
                    return <Badge variant="pending">{aggStatus}</Badge>;
                  })()}
                </div>
              </div>
              <div className="bg-background/25 border border-border rounded-xl p-3 flex flex-col gap-2">
                <span className="text-[10px] uppercase text-muted font-bold">Category Type</span>
                <div>
                  <Badge variant="outline" className="text-xs uppercase font-bold border-border bg-card">
                    {selectedInquiry.category}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Date and Contact */}
            <div className="bg-background/10 border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-0.5">Inquiry Date</span>
                  <strong className="text-foreground">{new Date(selectedInquiry.inquiry_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-0.5">Client Contact Person</span>
                  <strong className="text-foreground">{selectedInquiry.customers?.client_contact_person || 'No contact registered'}</strong>
                </div>
              </div>
            </div>

            {/* Quotation Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="text-xs text-primary font-bold uppercase tracking-wider border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
                📄 Quotation Details
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-0.5">Quotation Number</span>
                  <span className={`font-semibold ${selectedInquiry.quotation_number ? 'text-foreground' : 'text-pending'}`}>
                    {selectedInquiry.quotation_number || 'Waiting Input'}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-0.5">Quotation Date</span>
                  <span className="font-medium text-foreground">
                    {selectedInquiry.quotation_date ? new Date(selectedInquiry.quotation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-0.5">Lead Time</span>
                  <span className="font-semibold text-foreground">
                    {selectedInquiry.quotation_number ? `${selectedInquiry.lead_time_days || '-'} working days` : `${getDaysOpen(selectedInquiry.inquiry_date)} days open`}
                  </span>
                </div>
              </div>
              
              {selectedInquiry.status === 'PO Won' && selectedInquiry.po_number && (
                <div className="grid grid-cols-1 gap-2 border-t border-primary/10 pt-2.5 text-sm">
                  <div>
                    <span className="text-won block text-[10px] uppercase font-bold">🏆 Won Purchase Order (PO) Number</span>
                    <strong className="text-won text-base">{selectedInquiry.po_number}</strong>
                  </div>
                  {selectedInquiry.order_review && (
                    <div className="mt-1 p-3 bg-won/5 border border-won/10 rounded-lg">
                      <span className="text-muted block text-[9px] uppercase font-bold mb-1">Order Review Notes</span>
                      <p className="m-0 text-xs text-foreground italic leading-relaxed">{selectedInquiry.order_review}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Line Items View */}
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted flex justify-between border-b border-border pb-1.5 mb-3">
                <span className="font-extrabold text-foreground text-xs">📋 Inquiry Line Items</span>
                <span>{(selectedInquiry.inquiry_items || []).length} item(s)</span>
              </label>

              <div className="flex flex-col gap-3">
                {(selectedInquiry.inquiry_items || []).map((item, index) => {
                  const cast = parseFloat(item.cast_price) || 0;
                  const mach = parseFloat(item.mach_price) || 0;
                  const surf = parseFloat(item.surface_treatment) || 0;
                  const pack = parseFloat(item.packing_cost) || 0;
                  const cfrVal = parseFloat(item.cfr) || 0;
                  const quantity = parseInt(item.qty) || 0;
                  const liveTotalPerQty = cast + mach + surf + pack + cfrVal;
                  const liveTotalPrice = liveTotalPerQty * quantity;
                  const currencySym = selectedInquiry.currency === 'USD' ? '$' : selectedInquiry.currency === 'EUR' ? '€' : 'Rp';

                  return (
                    <div key={index} className="bg-background/20 p-4 rounded-xl border border-border flex flex-col gap-3">
                      {/* Name & Basic Info */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-foreground m-0">
                            {index + 1}. {item.item_name || 'Unnamed Item'}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] uppercase font-semibold">
                            {item.material && <span className="bg-card border border-border rounded px-2 py-0.5">🧪 {item.material}</span>}
                            {item.process && <span className="bg-card border border-border rounded px-2 py-0.5">⚙️ {item.process}</span>}
                            {item.tipe_proses && <span className="bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">🏷️ {item.tipe_proses}</span>}
                          </div>
                        </div>
                        <Badge variant={item.status === 'PO Won' ? 'won' : item.status === 'Canceled' ? 'outline' : item.status === 'Follow Up' ? 'follow' : 'pending'}>
                          {item.status || 'Pending Quotation'}
                        </Badge>
                      </div>

                      {/* Financial / Qty Summary */}
                      <div className="grid grid-cols-3 gap-3 bg-background/15 p-2.5 rounded-lg border border-border/20 text-xs">
                        <div>
                          <span className="text-muted block text-[9px] uppercase font-bold mb-0.5">Quantity</span>
                          <strong className="text-foreground text-[13px]">📦 {quantity.toLocaleString()} pcs</strong>
                        </div>
                        <div>
                          <span className="text-muted block text-[9px] uppercase font-bold mb-0.5">Price / Qty</span>
                          <strong className="text-foreground text-[13px]">{currencySym} {liveTotalPerQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span className="text-muted block text-[9px] uppercase font-bold mb-0.5">Total Price</span>
                          <strong className="text-won text-[13px]">{currencySym} {liveTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                      </div>

                      {/* Tooling and FAI section if relevant */}
                      {(item.tooling_cost || (item.fai_status && item.fai_status !== 'Pending')) && (
                        <div className={`grid gap-3 text-xs border-t border-dashed border-border pt-2 mt-0.5 ${item.tooling_cost ? 'grid-cols-[1fr_1.5fr]' : 'grid-cols-1'}`}>
                          {item.tooling_cost && (
                            <div>
                              <span className="text-muted block text-[9px] uppercase font-bold mb-0.5">Tooling Cost</span>
                              <strong className="text-foreground">{currencySym} {parseFloat(item.tooling_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                          )}
                          {item.fai_status && item.fai_status !== 'Pending' && (
                            <div>
                              <span className="text-muted block text-[9px] uppercase font-bold mb-0.5">Product Engineering FAI Status</span>
                              <span className={`font-bold ${item.fai_status === 'Approved' ? 'text-won' : item.fai_status === 'Rejected' ? 'text-stale' : 'text-follow'}`}>
                                {item.fai_status === 'Approved' ? '✓ Qualified / Approved' : item.fai_status === 'In Progress' ? '⚙️ In Progress / Trial' : `✗ Rejected`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Drawings list (View-only) */}
                      {item.id && (itemDrawings[item.id] || []).length > 0 && (
                        <div className="border-t border-dashed border-border pt-2.5 mt-0.5 flex flex-col gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-primary block">📎 Technical Drawings:</span>
                          <div className="flex flex-col gap-1">
                            {(itemDrawings[item.id] || []).map((drawing) => (
                              <div key={drawing.id} className="flex items-center justify-between p-2 bg-background/10 rounded-lg border border-border gap-2">
                                <span className="text-xs text-foreground truncate flex-1 min-w-0">📄 {drawing.file_name}</span>
                                <Button 
                                  type="button" 
                                  onClick={() => openDrawingViewer(drawing)}
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 py-0.5 px-2 text-[10px] font-bold text-primary border border-primary/20 hover:border-primary/45"
                                >
                                  Open PDF
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Remarks */}
            {selectedInquiry.remark && (
              <div className="bg-background/10 border border-border rounded-xl p-4 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-muted font-bold">Follow-up Remarks / Activities</span>
                <p className="m-0 text-xs text-foreground whitespace-pre-wrap leading-relaxed">{selectedInquiry.remark}</p>
              </div>
            )}

            {/* Drawer Footer View Only */}
            <div className="mt-6 pt-4 border-t border-border flex shrink-0">
              <Button 
                type="button" 
                variant="outline"
                className="w-full h-11 bg-card/50 hover:bg-card-hover text-foreground font-bold text-xs"
                onClick={() => { setIsDrawerOpen(false); setSelectedInquiry(null); }}
              >
                Close Meeting Review
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL POPUP: ADD INQUIRY */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[1002] flex items-center justify-center transition-opacity duration-250 ${isAddInquiryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`w-[500px] max-w-[92vw] bg-sidebar border border-border rounded-2xl shadow-2xl flex flex-col p-6 md:p-8 overflow-x-hidden transition-all duration-250 ease-in-out ${isAddInquiryOpen ? 'translate-y-0 opacity-100' : '-translate-y-5 opacity-0'}`}>
          <div className="flex items-center justify-between border-b border-border pb-4 mb-5 flex-shrink-0">
            <h2 className="text-lg font-bold text-foreground">Log New Inquiry</h2>
            <button 
              type="button"
              className="bg-transparent border-none text-muted hover:text-foreground cursor-pointer transition-colors p-1.5 rounded-full hover:bg-card-hover"
              onClick={() => setIsAddInquiryOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <form className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 w-full box-border" onSubmit={handleAddInquiry}>
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Select Customer</label>
              <Select 
                required
                value={newInquiry.customer_id}
                onChange={e => setNewInquiry({ ...newInquiry, customer_id: e.target.value })}
              >
                <option value="">-- Choose Company --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} (PIC: {c.pic_name})</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Inquiry Category</label>
              <Select 
                value={newInquiry.category}
                onChange={e => setNewInquiry({ ...newInquiry, category: e.target.value })}
              >
                <option value="others">Others</option>
                <option value="sand casting">Sand Casting</option>
                <option value="fabrication">Fabrication</option>
                <option value="investment">Investment Casting</option>
                <option value="forging">Forging</option>
              </Select>
            </div>

            {/* Line Items Section */}
            <div className="flex flex-col gap-2 min-w-0 mt-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted flex justify-between border-b border-border pb-1.5">
                <span>Line Items</span>
                <span className="normal-case font-normal">{newInquiry.items.length} item(s)</span>
              </label>
              
              <div className="flex flex-col gap-4 mt-3">
                {newInquiry.items.map((item, index) => {
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
                    <div key={index} className="bg-background/25 p-4 rounded-xl border border-border flex flex-col gap-3 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary">Item #{index + 1}</span>
                        {newInquiry.items.length > 1 && (
                          <button 
                            type="button" 
                            className="bg-transparent border-none text-stale hover:text-stale/80 cursor-pointer flex items-center gap-1 text-xs"
                            onClick={() => {
                              const updated = newInquiry.items.filter((_, idx) => idx !== index);
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          >
                            <X size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[2fr_1fr] gap-3">
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Item / Product Name *</label>
                          <Input 
                            type="text" 
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
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Qty *</label>
                          <Input 
                            type="number" 
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

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Material</label>
                          <Input 
                            type="text" 
                            placeholder="e.g. AISI 316" 
                            value={item.material || ''}
                            onChange={e => {
                              const updated = [...newInquiry.items];
                              updated[index].material = e.target.value;
                              setNewInquiry({ ...newInquiry, items: updated });
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 min-w-0">
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Process</label>
                          <Input 
                            type="text" 
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

                      <div className="border-t border-dashed border-border pt-2 mt-1">
                        <button
                          type="button"
                          className="bg-transparent border-none text-primary hover:text-primary/80 cursor-pointer font-semibold text-xs flex items-center gap-1"
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
                        <div className="flex flex-col gap-3 mt-1.5 p-3 bg-background/10 rounded-lg border border-border/20">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Tipe Proses</label>
                              <Select 
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
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Tooling Cost</label>
                              <Input 
                                type="number" 
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

                          <div className="grid grid-cols-5 gap-1.5">
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Cast Price</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.cast_price || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].cast_price = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Mach Price</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.mach_price || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].mach_price = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Surface Trt.</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.surface_treatment || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].surface_treatment = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">Packing Cost</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
                                placeholder="0" 
                                value={item.packing_cost || ''}
                                onChange={e => {
                                  const updated = [...newInquiry.items];
                                  updated[index].packing_cost = e.target.value;
                                  setNewInquiry({ ...newInquiry, items: updated });
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="text-[9px] uppercase tracking-wider font-semibold text-muted">CFR</label>
                              <Input 
                                type="number" 
                                className="h-8 px-2 text-xs"
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

                          <div className="flex justify-between border-t border-border/40 pt-2 text-xs">
                            <div>
                              <span className="text-muted">Total / Qty: </span>
                              <strong className="text-foreground">{liveTotalPerQty.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-muted">Total Price: </span>
                              <strong className="text-won">{liveTotalPrice.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button 
                type="button" 
                variant="secondary"
                size="sm"
                className="mt-3 self-start border border-border"
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
                <Plus size={14} /> Add Line Item
              </Button>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Quotation Number (Optional)</label>
              <Input 
                type="text" 
                placeholder="Can be inputted later" 
                value={newInquiry.quotation_number}
                onChange={e => setNewInquiry({ ...newInquiry, quotation_number: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Currency</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: 'USD', label: '🇺🇸 USD', sub: 'US Dollar' }, { value: 'IDR', label: '🇮🇩 IDR', sub: 'Rupiah' }, { value: 'EUR', label: '🇪🇺 EUR', sub: 'Euro' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewInquiry({ ...newInquiry, currency: opt.value })}
                    className={`p-2.5 rounded-lg border-2 flex flex-col items-center gap-0.5 font-bold text-xs transition-all duration-150 cursor-pointer ${
                      (newInquiry.currency || 'USD') === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-input text-muted hover:border-border/80 hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                    <span className="text-[9px] font-normal opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Est. Lead Time (Working Days)</label>
              <Input 
                type="number" 
                placeholder="e.g. 5" 
                value={newInquiry.lead_time_days}
                onChange={e => setNewInquiry({ ...newInquiry, lead_time_days: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Initial Remarks</label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                placeholder="Enter initial context or demands..." 
                value={newInquiry.remark}
                onChange={e => setNewInquiry({ ...newInquiry, remark: e.target.value })}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-border flex gap-3 shrink-0">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setIsAddInquiryOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-primary text-white h-11 hover:bg-primary/95">Log Inquiry</Button>
            </div>
          </form>
        </div>
      </div>

      {/* 5. MODAL POPUP: ADD CUSTOMER */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[1002] flex items-center justify-center transition-opacity duration-250 ${isAddCustomerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`w-[500px] max-w-[92vw] bg-sidebar border border-border rounded-2xl shadow-2xl flex flex-col p-6 md:p-8 overflow-x-hidden transition-all duration-250 ease-in-out ${isAddCustomerOpen ? 'translate-y-0 opacity-100' : '-translate-y-5 opacity-0'}`}>
          <div className="flex items-center justify-between border-b border-border pb-4 mb-5 flex-shrink-0">
            <h2 className="text-lg font-bold text-foreground">Register New Customer</h2>
            <button 
              type="button"
              className="bg-transparent border-none text-muted hover:text-foreground cursor-pointer transition-colors p-1.5 rounded-full hover:bg-card-hover"
              onClick={() => setIsAddCustomerOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <form className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 w-full box-border" onSubmit={handleAddCustomer}>
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Company Name</label>
              <Input 
                type="text" 
                placeholder="e.g. BOSCH AUTO SVC" 
                required
                value={newCustomer.company_name}
                onChange={e => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Sector Business</label>
              <Input 
                type="text" 
                placeholder="e.g. Automotive, Manufacturing" 
                value={newCustomer.sector_business}
                onChange={e => setNewCustomer({ ...newCustomer, sector_business: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Regional</label>
              <Input 
                type="text" 
                placeholder="e.g. Asia, North America, Europe" 
                value={newCustomer.regional}
                onChange={e => setNewCustomer({ ...newCustomer, regional: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Primary Email Address</label>
              <Input 
                type="email" 
                placeholder="customer@email.com" 
                value={newCustomer.email_address}
                onChange={e => setNewCustomer({ ...newCustomer, email_address: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Company Full Address</label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                placeholder="Enter postal street address..." 
                value={newCustomer.address}
                onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Client Contact Person</label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all duration-200 resize-y"
                placeholder="e.g. Pak Wafi, +62 812..." 
                value={newCustomer.client_contact_person || ''}
                onChange={e => setNewCustomer({ ...newCustomer, client_contact_person: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">Assigned PIC</label>
              <Select 
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
              </Select>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex gap-3 shrink-0">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-primary text-white h-11 hover:bg-primary/95">Add Customer</Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── PDF DRAWING VIEWER MODAL ── */}
      {viewerDrawing && (
        <div
          className="fixed inset-0 bg-black/90 z-[2000] flex flex-col"
          onClick={e => { if (e.target === e.currentTarget) closeDrawingViewer(); }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-sidebar border-b border-border gap-4 shrink-0">
            <span className="font-bold text-sm text-foreground truncate min-w-0">
              📄 {viewerDrawing.file_name}
            </span>
            <div className="flex gap-3 items-center shrink-0">
              {viewerUrl && (
                <a href={viewerUrl} target="_blank" rel="noreferrer"
                  className="text-xs font-semibold text-primary border border-primary/30 hover:border-primary/50 hover:bg-primary/5 rounded-lg py-1.5 px-3.5 transition-all">
                  ↓ Download
                </a>
              )}
              <button 
                type="button"
                className="bg-transparent border border-border hover:bg-card-hover text-muted hover:text-foreground cursor-pointer rounded-lg py-1 px-3 text-lg leading-none transition-all"
                onClick={closeDrawingViewer}
              >
                ×
              </button>
            </div>
          </div>

          {/* Viewer body */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            {viewerLoading ? (
              <div className="text-muted text-sm flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-3 border-border border-t-primary rounded-full animate-spin" />
                Loading drawing…
              </div>
            ) : viewerUrl ? (
              <iframe src={viewerUrl} title={viewerDrawing.file_name}
                className="w-full h-full border-0 rounded-lg bg-white" />
            ) : (
              <p className="text-stale">Failed to load drawing.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
