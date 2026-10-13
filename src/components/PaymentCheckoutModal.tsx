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
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [status, setStatus] = useState<
    'LOADING' | 'READY' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'CANCELLED'
  >('LOADING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedBalance, setVerifiedBalance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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

  // Create payment order on open
  useEffect(() => {
    if (!isOpen) {
      setOrderData(null);
      setStatus('LOADING');
      setErrorMessage(null);
      setVerifiedBalance(null);
      setIsVerifying(false);
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
        // Successful payment callback from Razorpay
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
          // User dismissed popup without paying
        },
      },
      prefill: {
        contact: '',
        email: '',
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

  // Simulate Sandbox / Test Payment (when keys are not yet configured on Vercel)
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md my-auto bg-navy-900 border border-navy-750 rounded-3xl shadow-2xl shadow-navy-950/90 overflow-hidden text-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 bg-navy-850/70">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-brand-purple" />
            <div>
              <h3 className="text-sm font-bold text-white">Secure Checkout</h3>
              <p className="text-[10px] text-slate-400">CampusConnect Payment Gateway</p>
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
        <div className="p-5 sm:p-6">
          {loading || status === 'LOADING' ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-brand-purple mx-auto" />
              <p className="text-xs text-slate-400">Preparing payment order...</p>
            </div>
          ) : status === 'PROCESSING' ? (
            <div className="py-16 text-center space-y-4 animate-fade-in">
              <Loader2 className="w-12 h-12 animate-spin text-brand-purple mx-auto" />
              <h4 className="text-base font-bold text-white">Verifying Payment</h4>
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
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
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
            /* READY STATE */
            <div className="space-y-5">
              {/* Order Summary Box */}
              <div className="p-4 rounded-2xl bg-navy-850 border border-navy-750 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-navy-800">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Package
                    </span>
                    <h4 className="text-sm font-bold text-white">{packageName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
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
                  <span className="text-slate-400">One-time payment</span>
                </div>
              </div>

              {/* Payment Processing Options */}
              {orderData?.isConfigured ? (
                /* Real Razorpay Mode */
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleLaunchRazorpay}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{priceInInr} via Razorpay</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Supports UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking</span>
                  </p>
                </div>
              ) : (
                /* Gateway Environment Notice & Sandbox Test Mode */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Payment Gateway Notice</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      To accept live Indian UPI and card payments, configure <code className="text-amber-300 font-mono">RAZORPAY_KEY_ID</code> and <code className="text-amber-300 font-mono">RAZORPAY_KEY_SECRET</code> in your Vercel Environment Variables.
                    </p>
                    <p className="text-[11px] text-emerald-300 font-semibold">
                      💡 Sandbox Test Mode is active: You can complete this transaction now to test instant credit delivery.
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

              {/* Guarantees */}
              <div className="pt-2 border-t border-navy-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Credits never expire and are only deducted upon successful connection.</span>
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
