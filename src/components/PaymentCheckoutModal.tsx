'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Lock,
  Info,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Upload,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface PaymentCheckoutModalProps {
  packageId: string;
  packageName: string;
  priceInInr: number;
  credits: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

export default function PaymentCheckoutModal({
  packageId,
  packageName,
  priceInInr,
  credits,
  isOpen,
  onClose,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const [paymentMode, setPaymentMode] = useState<'GATEWAY' | 'UPI_QR'>('GATEWAY');

  // Gateway order state
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [status, setStatus] = useState<
    'LOADING' | 'READY' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'CANCELLED'
  >('LOADING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedBalance, setVerifiedBalance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Manual UPI QR state
  const [qrOrderData, setQrOrderData] = useState<any>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [submittedUtrInfo, setSubmittedUtrInfo] = useState<{
    orderId: string;
    utrNumber: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Dynamically load Razorpay SDK
  useEffect(() => {
    if (!isOpen) return;

    if (!(window as any).Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isOpen]);

  // Reset & load Gateway order on modal open
  useEffect(() => {
    if (!isOpen) {
      setOrderData(null);
      setQrOrderData(null);
      setStatus('LOADING');
      setErrorMessage(null);
      setVerifiedBalance(null);
      setIsVerifying(false);
      setUtrNumber('');
      setReceiptFile(null);
      setReceiptPreview(null);
      setSubmittedUtrInfo(null);
      setPaymentMode('GATEWAY');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setStatus('LOADING');
    setErrorMessage(null);

    const initOrder = async () => {
      try {
        const res = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to initialize payment order');
        }

        if (isMounted) {
          setOrderData(data);
          setStatus('READY');
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Unable to connect to payment service.');
          setStatus('ERROR');
          setLoading(false);
        }
      }
    };

    initOrder();

    return () => {
      isMounted = false;
    };
  }, [isOpen, packageId]);

  // Load UPI QR order details
  const loadQrOrder = async () => {
    if (qrOrderData) return;
    setLoadingQr(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/payments/create-qr-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQrOrderData(data);
      } else {
        setErrorMessage(data.message || 'Unable to generate UPI QR order.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error generating UPI QR.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleSwitchTab = (mode: 'GATEWAY' | 'UPI_QR') => {
    setPaymentMode(mode);
    setErrorMessage(null);
    if (mode === 'UPI_QR' && !qrOrderData) {
      loadQrOrder();
    }
  };

  // Open Razorpay Standard Checkout
  const handleLaunchRazorpay = () => {
    if (!orderData) return;

    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      setErrorMessage('Razorpay payment gateway SDK is loading. Please try again in a moment.');
      return;
    }

    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'CampusConnect',
      description: `${orderData.credits} Conversation Credits (${orderData.packageName})`,
      order_id: orderData.razorpayOrderId,
      image: '/favicon.ico',
      handler: async function (response: any) {
        setIsVerifying(true);
        setStatus('PROCESSING');
        try {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderData.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.message || 'Payment verification failed.');
          }

          setVerifiedBalance(verifyData.newBalance ?? verifyData.balance);
          setStatus('SUCCESS');
          onSuccess(verifyData.newBalance ?? verifyData.balance);
        } catch (verErr: any) {
          setErrorMessage(verErr.message || 'Failed to verify payment with server.');
          setStatus('ERROR');
        } finally {
          setIsVerifying(false);
        }
      },
      modal: {
        ondismiss: function () {
          // User closed modal
        },
      },
      notes: {
        packageId: packageId,
        orderId: orderData.orderId,
      },
      theme: {
        color: '#7c3aed',
      },
    };

    try {
      const rzpInstance = new Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      setErrorMessage('Failed to open Razorpay checkout: ' + err.message);
    }
  };

  // Sandbox simulation payment (when gateway credentials are not configured)
  const handleSimulateSandboxPayment = async () => {
    if (!orderData) return;

    setIsVerifying(true);
    setStatus('PROCESSING');
    try {
      const res = await fetch('/api/payments/simulate-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Sandbox verification failed');
      }

      setVerifiedBalance(data.newBalance ?? data.balance);
      setStatus('SUCCESS');
      onSuccess(data.newBalance ?? data.balance);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment verification failed');
      setStatus('ERROR');
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Receipt image selection
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const url = URL.createObjectURL(file);
    setReceiptPreview(url);
  };

  // Submit UTR & Screenshot for Admin verification
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrOrderData?.orderId) return;

    if (!utrNumber.trim()) {
      setErrorMessage('Please enter the 12-digit UTR or Transaction Reference number.');
      return;
    }

    setSubmittingUtr(true);
    setErrorMessage(null);

    try {
      let uploadedReceiptUrl: string | null = null;
      if (receiptFile) {
        setUploadingReceipt(true);
        const formData = new FormData();
        formData.append('file', receiptFile);
        const uploadRes = await fetch('/api/payments/upload-receipt', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          uploadedReceiptUrl = uploadData.fileUrl || uploadData.url;
        }
        setUploadingReceipt(false);
      }

      const res = await fetch('/api/payments/submit-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: qrOrderData.orderId,
          utrNumber: utrNumber.trim(),
          receiptUrl: uploadedReceiptUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit payment confirmation.');
      }

      setSubmittedUtrInfo({
        orderId: qrOrderData.orderId,
        utrNumber: data.utrNumber || utrNumber.trim(),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit UTR confirmation.');
    } finally {
      setSubmittingUtr(false);
      setUploadingReceipt(false);
    }
  };

  // Poll order status when pending verification
  useEffect(() => {
    if (!submittedUtrInfo?.orderId || status === 'SUCCESS') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/order-status?orderId=${submittedUtrInfo.orderId}`);
        const data = await res.json();
        if (res.ok && data.success && data.status === 'PAID') {
          clearInterval(interval);
          setVerifiedBalance(data.currentBalance);
          setStatus('SUCCESS');
          onSuccess(data.currentBalance);
        }
      } catch {
        //
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [submittedUtrInfo, status, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto bg-navy-900 border border-navy-750 rounded-3xl shadow-2xl shadow-navy-950/90 overflow-hidden text-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 bg-navy-850/70">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-brand-purple" />
            <div>
              <h3 className="text-sm font-bold text-white">Secure Student Checkout</h3>
              <p className="text-[10px] text-slate-400">CampusConnect Payment Portal</p>
            </div>
          </div>
          {status !== 'SUCCESS' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
              title="Close payment window"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {loading || status === 'LOADING' ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-brand-purple mx-auto" />
              <p className="text-xs text-slate-400">Preparing payment order...</p>
            </div>
          ) : status === 'PROCESSING' ? (
            <div className="py-16 text-center space-y-4 animate-fade-in">
              <Loader2 className="w-12 h-12 animate-spin text-brand-purple mx-auto" />
              <h4 className="text-base font-bold text-white">Verifying Transaction</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Validating cryptographic payment signature and crediting your account atomically...
              </p>
            </div>
          ) : status === 'ERROR' ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Payment Issue</h4>
              <p className="text-xs text-rose-300 max-w-xs mx-auto">{errorMessage}</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setStatus('READY');
                    setErrorMessage(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 text-xs font-semibold text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          ) : status === 'SUCCESS' ? (
            /* SUCCESS STATE */
            <div className="py-6 text-center space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wide uppercase mb-2">
                  Payment Verified & Completed
                </span>
                <h4 className="text-xl font-black text-white">+{credits} Chat Credits Added!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Your chat credits have been credited to your verified student profile.
                </p>
              </div>

              {verifiedBalance !== null && (
                <div className="p-3.5 rounded-2xl bg-navy-850 border border-navy-750 text-xs text-slate-300">
                  <span>Updated verified balance: </span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {verifiedBalance} Credits
                  </strong>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-lg shadow-brand-purple/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue Networking</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* READY STATE WITH DUAL TABS */
            <div className="space-y-4">
              {/* Order Summary Box */}
              <div className="p-4 rounded-2xl bg-navy-850 border border-navy-750 space-y-2.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-navy-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Package
                    </span>
                    <h4 className="text-sm font-bold text-white">{packageName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Total Due
                    </span>
                    <p className="text-xl font-black text-white">₹{priceInInr}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>+{credits} Conversation Credits</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Locked server price</span>
                </div>
              </div>

              {/* Payment Mode Selector Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-navy-950/80 border border-navy-750">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('GATEWAY')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMode === 'GATEWAY'
                      ? 'bg-brand-purple text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Online Gateway</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab('UPI_QR')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMode === 'UPI_QR'
                      ? 'bg-electric-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Direct UPI QR</span>
                </button>
              </div>

              {/* TAB 1: Online Gateway (Razorpay) */}
              {paymentMode === 'GATEWAY' && (
                <div className="space-y-3 pt-1">
                  {orderData?.isConfigured ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleLaunchRazorpay}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Pay ₹{priceInInr} via Razorpay Gateway</span>
                      </button>
                      <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Instant delivery: UPI, Cards & NetBanking</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Info className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Gateway Notice</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          To accept live card and UPI payments through the Razorpay popup, configure <code className="text-amber-300 font-mono">RAZORPAY_KEY_ID</code> and <code className="text-amber-300 font-mono">RAZORPAY_KEY_SECRET</code> on Vercel.
                        </p>
                        <p className="text-[11px] text-emerald-300 font-semibold">
                          💡 You can also switch to the <strong>Direct UPI QR</strong> tab above to pay via any UPI app, or complete in Test Mode below.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSimulateSandboxPayment}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Complete Test Payment & Add {credits} Credits</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Direct UPI QR Code (Scan, UTR & Screenshot) */}
              {paymentMode === 'UPI_QR' && (
                <div className="space-y-3 pt-1">
                  {loadingQr ? (
                    <div className="py-12 text-center space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-electric-400 mx-auto" />
                      <p className="text-xs text-slate-400">Generating personal UPI QR...</p>
                    </div>
                  ) : submittedUtrInfo ? (
                    /* Submitted confirmation screen */
                    <div className="p-5 rounded-2xl bg-navy-850 border border-navy-750 text-center space-y-3 animate-fade-in">
                      <div className="w-12 h-12 rounded-full bg-electric-500/20 text-electric-400 flex items-center justify-center mx-auto">
                        <Clock className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Payment Submitted for Review</h4>
                      <p className="text-xs text-slate-300">
                        Reference / UTR: <strong className="text-white font-mono">{submittedUtrInfo.utrNumber}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Your transaction is recorded and pending administrator verification. Credits will be automatically added to your balance upon approval.
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-electric-400 font-mono">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Awaiting administrator confirmation...</span>
                      </div>
                    </div>
                  ) : (
                    /* QR Display and UTR Entry Form */
                    <div className="space-y-3">
                      {/* QR Display Card */}
                      <div className="p-3.5 rounded-2xl bg-navy-850 border border-navy-750 flex flex-col sm:flex-row items-center gap-4">
                        <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                          {qrOrderData?.customQrImageUrl ? (
                            <img
                              src={qrOrderData.customQrImageUrl}
                              alt="UPI QR Code"
                              className="w-36 h-36 object-contain rounded"
                            />
                          ) : qrOrderData?.qrCodeDataUrl ? (
                            <img
                              src={qrOrderData.qrCodeDataUrl}
                              alt="UPI QR Code"
                              className="w-36 h-36 object-contain rounded"
                            />
                          ) : (
                            <div className="w-36 h-36 flex items-center justify-center text-navy-950 font-bold text-xs">
                              QR Code
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-2 text-xs min-w-0">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                              Receiver Name
                            </span>
                            <p className="font-bold text-white truncate">
                              {qrOrderData?.receiverName || 'KRISH SO ANIL KUMAR'}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                              UPI ID (VPA)
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-amber-300 font-mono text-[11px] bg-navy-900 px-2 py-0.5 rounded border border-navy-750 truncate">
                                {qrOrderData?.upiId || '9138060466@naviaxis'}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    qrOrderData?.upiId || '9138060466@naviaxis',
                                    'upi'
                                  )
                                }
                                className="p-1 rounded bg-navy-800 hover:bg-navy-750 text-slate-300"
                                title="Copy UPI ID"
                              >
                                {copiedField === 'upi' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                              Locked Amount
                            </span>
                            <p className="font-black text-emerald-400 text-sm">₹{priceInInr}</p>
                          </div>
                        </div>
                      </div>

                      {/* UTR & Screenshot Form */}
                      <form onSubmit={handleSubmitUtr} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            12-Digit UTR / Transaction Reference Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 428719283741 or UPI Ref ID"
                            value={utrNumber}
                            onChange={(e) => setUtrNumber(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-electric-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Upload Payment Screenshot (Optional)
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 px-3 py-2 rounded-xl bg-navy-950 border border-dashed border-navy-750 hover:border-electric-500 text-slate-400 hover:text-white text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors">
                              <Upload className="w-3.5 h-3.5" />
                              <span className="truncate">
                                {receiptFile ? receiptFile.name : 'Choose screenshot image...'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleReceiptFileChange}
                                className="hidden"
                              />
                            </label>
                            {receiptPreview && (
                              <img
                                src={receiptPreview}
                                alt="Preview"
                                className="w-9 h-9 object-cover rounded-lg border border-navy-700 shrink-0"
                              />
                            )}
                          </div>
                        </div>

                        {errorMessage && (
                          <p className="text-xs text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{errorMessage}</span>
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submittingUtr || uploadingReceipt}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-electric-500 to-brand-purple hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-electric-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {submittingUtr || uploadingReceipt ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting Payment Confirmation...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Submit Payment Confirmation</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* Guarantees */}
              <div className="pt-2 border-t border-navy-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Credits never expire and are only deducted upon mutual connection.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Verified student access with strict privacy protection.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
