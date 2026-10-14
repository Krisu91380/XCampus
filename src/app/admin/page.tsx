'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  Coins,
  MessageSquare,
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  History,
  Tag,
  Plus,
  Loader2,
  Ban,
  Check,
  X,
  QrCode,
  Upload,
  Copy,
  ExternalLink,
  Eye,
  AlertCircle,
  FileCheck,
  Info,
  LogOut,
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'verifications' | 'universities' | 'reports' | 'packages' | 'orders' | 'payment-settings' | 'audit'
  >('overview');
  const [stats, setStats] = useState<any>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Orders filter & action states
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REJECTED'>('ALL');
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Payment Settings & Custom QR states
  const [paymentSettings, setPaymentSettings] = useState<{
    isEnabled: boolean;
    receiverName: string;
    upiId: string;
    qrImageUrl: string;
    instructions: string;
  }>({
    isEnabled: true,
    receiverName: 'KRISH SO ANIL KUMAR',
    upiId: '',
    qrImageUrl: '/uploads/payment/custom_qr.png',
    instructions: '',
  });
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);

  // Form states for university creation
  const [newUni, setNewUni] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    approvedDomains: '',
  });

  const loadAdminData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      const statsData = await statsRes.json();
      if (!statsRes.ok || !statsData.success) {
        alert('Admin authorization failed.');
        router.push('/login');
        return;
      }
      setStats(statsData.stats);

      const [verRes, uniRes, repRes, pkgRes, ordRes, audRes, paySetRes] = await Promise.all([
        fetch('/api/admin/verifications').then((r) => r.json()),
        fetch('/api/admin/universities').then((r) => r.json()),
        fetch('/api/admin/moderation').then((r) => r.json()),
        fetch('/api/admin/packages').then((r) => r.json()),
        fetch('/api/admin/orders').then((r) => r.json()),
        fetch('/api/admin/audit-logs').then((r) => r.json()),
        fetch('/api/admin/payment-settings').then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (verRes.success) setVerifications(verRes.verifications);
      if (uniRes.success) setUniversities(uniRes.universities);
      if (repRes.success) setReports(repRes.reports);
      if (pkgRes.success) setPackages(pkgRes.packages);
      if (ordRes.success) setOrders(ordRes.orders);
      if (audRes.success) setAuditLogs(audRes.logs);
      if (paySetRes.success) {
        setPaymentSettings(paySetRes.settings);
        setQrPreviewUrl(paySetRes.settings.qrImageUrl);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleReviewVerification = async (verificationId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert(data.message);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUni),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert('University added successfully.');
      setNewUni({ name: '', code: '', city: '', state: '', approvedDomains: '' });
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleUniActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch('/api/admin/universities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleModerationAction = async (action: string, targetUserId?: string, reportId?: string) => {
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetUserId, reportId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert(data.message);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Payment Manual Verification Handlers
  const handleApproveOrder = async (orderId: string) => {
    setActionLoadingOrderId(orderId);
    try {
      const res = await fetch('/api/admin/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert(data.message);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Enter rejection reason for student:', 'Payment could not be verified in UPI account.');
    if (reason === null) return;
    setActionLoadingOrderId(orderId);
    try {
      const res = await fetch('/api/admin/orders/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert(data.message);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingOrderId(null);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to refund this order and reverse the purchased credits?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert(data.message);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdatePackage = async (id: string, priceInInr: number, credits: number) => {
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priceInInr, credits }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      alert('Package updated successfully.');
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Payment Settings Handlers
  const handleQrFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('QR code image must be under 5MB.');
      return;
    }
    setSelectedQrFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setQrPreviewUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccessMsg(null);
    try {
      let finalQrUrl = paymentSettings.qrImageUrl;
      if (selectedQrFile) {
        setUploadingQr(true);
        const formData = new FormData();
        formData.append('file', selectedQrFile);
        const upRes = await fetch('/api/admin/payment-settings/upload', {
          method: 'POST',
          body: formData,
        });
        const upData = await upRes.json();
        if (!upRes.ok || !upData.success) {
          throw new Error(upData.message || 'Failed to upload QR code image');
        }
        finalQrUrl = upData.fileUrl;
        setUploadingQr(false);
      }

      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: paymentSettings.isEnabled,
          receiverName: paymentSettings.receiverName,
          upiId: paymentSettings.upiId,
          qrImageUrl: finalQrUrl,
          instructions: paymentSettings.instructions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setSettingsSuccessMsg('Payment settings and QR code saved successfully to disk!');
      setSelectedQrFile(null);
      loadAdminData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
      setUploadingQr(false);
    }
  };

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
        <p className="text-xs">Authenticating and loading administrative console...</p>
      </div>
    );
  }

  const pendingVerificationOrders = orders.filter((o) => o.status === 'PENDING_VERIFICATION');
  const filteredOrders =
    orderFilter === 'PENDING'
      ? orders.filter((o) => o.status === 'PENDING_VERIFICATION')
      : orderFilter === 'PAID'
      ? orders.filter((o) => o.status === 'PAID')
      : orderFilter === 'REJECTED'
      ? orders.filter((o) => o.status === 'REJECTED')
      : orders;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Super Administrator Operations Console</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Platform Administration</h1>
          <p className="text-xs text-slate-400 mt-1">
            Governance, student verification review, revenue ledgers, and manual UPI QR payment approvals.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setActiveTab('verifications')}
            className={`px-3 py-2 rounded-xl transition-all relative ${
              activeTab === 'verifications'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Verifications
            {stats?.pendingVerifications > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                {stats.pendingVerifications}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-2 rounded-xl transition-all relative ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Orders & Verification ({orders.length})
            {pendingVerificationOrders.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-navy-950 font-bold text-[10px] animate-pulse">
                {pendingVerificationOrders.length} PENDING
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payment-settings')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'payment-settings'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Payment Settings & QR
          </button>
          <button
            onClick={() => setActiveTab('universities')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'universities'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Universities ({universities.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'reports'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Moderation & Reports
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'packages'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Pricing & Packages
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2 rounded-xl transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-navy-950 font-bold'
                : 'bg-navy-900 text-slate-300 hover:bg-navy-850'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to log out of the Administrator console?')) {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
                router.refresh();
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Log out of Super Administrator session"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Admin Logout</span>
          </button>
        </div>
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-6 border border-navy-750">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Total Registered Users</span>
                <Users className="w-5 h-5 text-electric-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{stats?.totalUsers}</p>
              <p className="text-[11px] text-emerald-400 mt-2 font-medium">
                {stats?.verifiedUsers} ID Verified Students
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-navy-750">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Active Conversations</span>
                <MessageSquare className="w-5 h-5 text-brand-purple" />
              </div>
              <p className="text-3xl font-extrabold text-white">{stats?.activeConversations}</p>
              <p className="text-[11px] text-slate-400 mt-2">
                {stats?.totalConversations} total sessions recorded
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-navy-750">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Platform Revenue (INR)</span>
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">₹{stats?.totalRevenueInInr}</p>
              <p className="text-[11px] text-amber-400 mt-2">
                {stats?.confirmedTransactionsCount} confirmed transactions
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-navy-750">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Pending Safety Queue</span>
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{stats?.pendingReports}</p>
              <p className="text-[11px] text-slate-400 mt-2">
                {pendingVerificationOrders.length} payments awaiting manual review
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. VERIFICATIONS QUEUE TAB */}
      {activeTab === 'verifications' && (
        <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Student Verification Queue
          </h3>

          {verifications.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No student verification records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-navy-800">
                    <th className="pb-3">Student</th>
                    <th className="pb-3">University</th>
                    <th className="pb-3">Document / Evidence</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60 text-slate-300">
                  {verifications.map((v) => (
                    <tr key={v.id}>
                      <td className="py-3 font-medium text-white">
                        {v.studentName} <br />
                        <span className="text-[10px] text-slate-500 font-mono">{v.studentEmail}</span>
                      </td>
                      <td className="py-3">{v.universityName}</td>
                      <td className="py-3 text-[11px]">
                        {v.documentType === 'INSTITUTION_EMAIL' ? (
                          <span className="text-electric-400 font-mono">{v.institutionalEmail}</span>
                        ) : v.idCardUrl ? (
                          <a
                            href={v.idCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-purple underline"
                          >
                            View Student ID Document ↗
                          </a>
                        ) : (
                          'No attachment'
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : v.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {v.status === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReviewVerification(v.id, 'APPROVE')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewVerification(v.id, 'REJECT')}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. PAYMENT ORDERS & VERIFICATION TAB */}
      {activeTab === 'orders' && (
        <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-navy-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                Payment Orders & Manual UPI Verification
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review student UTR submissions, inspect payment screenshots, and approve or reject credits.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-navy-900 p-1 rounded-xl border border-navy-800 text-xs">
              <button
                onClick={() => setOrderFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  orderFilter === 'ALL' ? 'bg-amber-500 text-navy-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setOrderFilter('PENDING')}
                className={`px-2.5 py-1 rounded-lg transition-all relative ${
                  orderFilter === 'PENDING' ? 'bg-amber-500 text-navy-950 font-bold' : 'text-amber-400 hover:text-white'
                }`}
              >
                Pending ({pendingVerificationOrders.length})
              </button>
              <button
                onClick={() => setOrderFilter('PAID')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  orderFilter === 'PAID' ? 'bg-emerald-500 text-navy-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Approved ({orders.filter((o) => o.status === 'PAID').length})
              </button>
              <button
                onClick={() => setOrderFilter('REJECTED')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  orderFilter === 'REJECTED' ? 'bg-rose-500 text-navy-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected ({orders.filter((o) => o.status === 'REJECTED').length})
              </button>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">
              No orders found matching the selected filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-400 uppercase border-b border-navy-800 bg-navy-900/60">
                  <tr>
                    <th className="py-3 px-3">Order / Date</th>
                    <th className="py-3 px-3">Student</th>
                    <th className="py-3 px-3">Package / Amount</th>
                    <th className="py-3 px-3">Submitted UTR</th>
                    <th className="py-3 px-3">Receipt Screenshot</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-850 font-mono text-[11px]">
                  {filteredOrders.map((o) => {
                    const isPending = o.status === 'PENDING_VERIFICATION';
                    const isActionLoading = actionLoadingOrderId === o.id;

                    return (
                      <tr
                        key={o.id}
                        className={`transition-colors ${
                          isPending ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-navy-850/40'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className="font-bold text-white block">{o.id}</span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            {format(new Date(o.createdAt), 'dd MMM yyyy, hh:mm a')}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-300 font-sans">
                          <span className="text-white block font-medium">{o.userEmail}</span>
                          <span className="text-[10px] text-slate-500 font-mono">UID: {o.userId.slice(0, 10)}...</span>
                        </td>

                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-white block">{o.packageName}</span>
                          <span className="text-emerald-400 font-bold font-mono">+{o.credits} Credits</span>
                          <span className="text-white font-bold block mt-0.5">₹{o.amountInInr}</span>
                        </td>

                        {/* UTR Column */}
                        <td className="py-3 px-3">
                          {o.utrNumber ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-1 rounded bg-navy-900 border border-navy-700 text-amber-300 font-bold font-mono select-all">
                                {o.utrNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUtr(o.utrNumber)}
                                className="p-1 rounded hover:bg-navy-800 text-slate-400 hover:text-white transition-colors"
                                title="Copy UTR to verify in UPI app"
                              >
                                {copiedUtr === o.utrNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px]">No UTR submitted</span>
                          )}
                        </td>

                        {/* Receipt Screenshot Column */}
                        <td className="py-3 px-3 font-sans">
                          {o.receiptUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptUrl(o.receiptUrl)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-850 hover:bg-navy-800 border border-navy-700 text-electric-400 text-[11px] font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">None attached</span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              o.status === 'PAID'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : o.status === 'PENDING_VERIFICATION'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : o.status === 'CREATED'
                                ? 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
                                : o.status === 'REFUNDED'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {o.status === 'PENDING_VERIFICATION' ? 'Awaiting Review' : o.status}
                          </span>
                          {o.rejectionReason && (
                            <p className="text-[10px] text-rose-400 mt-1 font-sans truncate max-w-[140px]">
                              {o.rejectionReason}
                            </p>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3 px-3 text-right font-sans">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(o.id)}
                                disabled={isActionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 transition-colors shadow-sm shadow-emerald-600/30"
                              >
                                {isActionLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(o.id)}
                                disabled={isActionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : o.status === 'PAID' ? (
                            <button
                              onClick={() => handleRefundOrder(o.id)}
                              className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-[10px] font-bold border border-rose-700/50 transition-colors"
                            >
                              Refund Order
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">No action</span>
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

      {/* 4. PAYMENT SETTINGS & CUSTOM QR CODE TAB */}
      {activeTab === 'payment-settings' && (
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-brand-purple" />
              UPI QR Code & Manual Payment Gate Settings
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Upload your personal static UPI QR code image (PhonePe, Google Pay, Paytm) to be displayed on student checkouts. Changes persist across application restarts.
            </p>
          </div>

          {settingsSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{settingsSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSavePaymentSettings} className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: QR Code Image Upload & Live Preview */}
              <div className="space-y-4">
                <label className="block text-slate-300 font-bold text-xs">
                  Static UPI QR Code Image (PNG, JPG, WebP)
                </label>

                {/* QR Code Preview Box */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center max-w-xs shadow-md">
                  {qrPreviewUrl ? (
                    <img
                      src={qrPreviewUrl}
                      alt="UPI QR Code Preview"
                      className="w-56 h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                      <QrCode className="w-12 h-12 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No QR code uploaded yet</p>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] font-bold text-slate-900 text-center uppercase tracking-wider">
                    {paymentSettings.receiverName || 'KRISH SO ANIL KUMAR'}
                  </p>
                </div>

                {/* File Upload Selector */}
                <div>
                  <label
                    htmlFor="qr-file-input"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-white font-semibold text-xs transition-colors"
                  >
                    <Upload className="w-4 h-4 text-brand-purple" />
                    <span>Upload New QR Image From Computer</span>
                  </label>
                  <input
                    id="qr-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrFileSelected}
                    className="hidden"
                  />
                  {selectedQrFile && (
                    <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 font-mono">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Ready to save: {selectedQrFile.name} ({(selectedQrFile.size / 1024).toFixed(1)} KB)</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Receiver Details & Instructions */}
              <div className="space-y-4">
                {/* Enable/Disable Toggle */}
                <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold text-xs block">Enable UPI Payments</span>
                    <span className="text-[11px] text-slate-400">
                      When disabled, students will see a maintenance message at checkout.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentSettings.isEnabled}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, isEnabled: e.target.checked })}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Payment Receiver Name */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Receiver Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.receiverName}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, receiverName: e.target.value })}
                    placeholder="e.g. KRISH SO ANIL KUMAR"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Display name shown to students scanning your QR code.
                  </p>
                </div>

                {/* Optional UPI ID */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    UPI ID / VPA (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.upiId}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                    placeholder="e.g. username@upi or mobile@ybl"
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Allows mobile students to copy your VPA or open UPI intent directly.
                  </p>
                </div>

                {/* Instructions Textarea */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Student Payment Instructions
                  </label>
                  <textarea
                    rows={4}
                    value={paymentSettings.instructions}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, instructions: e.target.value })}
                    placeholder="1. Scan the QR code... 2. Pay exact amount... 3. Enter UTR..."
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white text-xs leading-relaxed focus:outline-none focus:border-amber-400 resize-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Clear instructions shown right below the QR code in the checkout modal.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-navy-800 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings || uploadingQr}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-navy-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                {savingSettings || uploadingQr ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Payment Settings...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Payment Settings &amp; QR</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. UNIVERSITIES DIRECTORY TAB */}
      {activeTab === 'universities' && (
        <div className="space-y-6 animate-fade-in">
          {/* Add University Form */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-electric-400" />
              Add Verified Partner University
            </h3>
            <form onSubmit={handleCreateUniversity} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">University Name</label>
                <input
                  type="text"
                  required
                  value={newUni.name}
                  onChange={(e) => setNewUni({ ...newUni, name: e.target.value })}
                  placeholder="e.g. Chandigarh University"
                  className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Code / Acronym</label>
                <input
                  type="text"
                  required
                  value={newUni.code}
                  onChange={(e) => setNewUni({ ...newUni, code: e.target.value })}
                  placeholder="e.g. CU"
                  className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">City</label>
                <input
                  type="text"
                  required
                  value={newUni.city}
                  onChange={(e) => setNewUni({ ...newUni, city: e.target.value })}
                  placeholder="e.g. Mohali"
                  className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">State</label>
                <input
                  type="text"
                  required
                  value={newUni.state}
                  onChange={(e) => setNewUni({ ...newUni, state: e.target.value })}
                  placeholder="e.g. Punjab"
                  className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Approved Domains (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={newUni.approvedDomains}
                  onChange={(e) => setNewUni({ ...newUni, approvedDomains: e.target.value })}
                  placeholder="e.g. cumail.in, cu.edu.in"
                  className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold transition-all shadow-md shadow-amber-500/20"
                >
                  Create University
                </button>
              </div>
            </form>
          </div>

          {/* Universities Table */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750">
            <h4 className="text-sm font-bold text-white mb-4">Supported Higher Institutions</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-navy-800 text-slate-400">
                  <tr>
                    <th className="pb-3">Institution Name</th>
                    <th className="pb-3">Code</th>
                    <th className="pb-3">Location</th>
                    <th className="pb-3">Email Domains</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-850 text-slate-300">
                  {universities.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 font-semibold text-white">{u.name}</td>
                      <td className="py-3 font-mono text-electric-400">{u.code}</td>
                      <td className="py-3">{u.city}, {u.state}</td>
                      <td className="py-3 font-mono text-[11px] text-slate-400">
                        {u.approvedDomains?.join(', ')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {u.isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleToggleUniActive(u.id, u.isActive)}
                          className="px-2.5 py-1 rounded bg-navy-850 hover:bg-navy-800 text-[10px] font-bold text-slate-300 transition-colors"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODERATION & REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Safety & Moderation Incidents
          </h3>

          {reports.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No reports or user safety flags registered.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-navy-900 border border-navy-800 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400 uppercase tracking-wide text-[11px]">
                      Reason: {r.reason}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {format(new Date(r.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>

                  <p className="text-slate-200 bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                    "{r.details}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-navy-800">
                    <span>
                      Reported Student: <strong className="text-white">{r.reportedUserName}</strong> ({r.reportedUserEmail})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleModerationAction('SUSPEND_USER', r.reportedUserId)}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
                      >
                        Suspend Account
                      </button>
                      <button
                        onClick={() => handleModerationAction('RESOLVE_REPORT', undefined, r.id)}
                        className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-750 text-slate-200"
                      >
                        Dismiss / Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. PRICING & PACKAGES TAB */}
      {activeTab === 'packages' && (
        <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              Configurable Credit Packages
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure prices and credit allocations for student chat passes. Changes update the pricing page instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div key={pkg.id} className="p-5 rounded-2xl bg-navy-900 border border-navy-800 text-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">{pkg.name}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold font-mono">
                    ₹{pkg.priceInInr}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">{pkg.description}</p>

                <div className="space-y-3 pt-2 border-t border-navy-800">
                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold mb-1">Price in INR (₹)</label>
                    <input
                      type="number"
                      defaultValue={pkg.priceInInr}
                      id={`price-${pkg.id}`}
                      className="w-full px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-750 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold mb-1">Chat Credits</label>
                    <input
                      type="number"
                      defaultValue={pkg.credits}
                      id={`credits-${pkg.id}`}
                      className="w-full px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-750 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const priceInput = document.getElementById(`price-${pkg.id}`) as HTMLInputElement;
                      const creditsInput = document.getElementById(`credits-${pkg.id}`) as HTMLInputElement;
                      if (priceInput && creditsInput) {
                        handleUpdatePackage(pkg.id, parseFloat(priceInput.value), parseInt(creditsInput.value));
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-xs transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-electric-400" />
            Administrative Security Audit Trail
          </h3>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No actions logged yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-navy-900 border border-navy-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-amber-400">{log.action}</span>
                    <span className="text-slate-400 ml-2">by {log.adminEmail}</span>
                    {log.details && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{log.details}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {format(new Date(log.createdAt), 'dd MMM, hh:mm a')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-2xl w-full bg-navy-900 border border-navy-750 rounded-2xl overflow-hidden p-6 text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Uploaded Payment Screenshot</span>
              </h4>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-navy-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
              <img
                src={previewReceiptUrl}
                alt="Submitted Payment Proof"
                className="max-h-[65vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-electric-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Full Size in New Tab</span>
              </a>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
