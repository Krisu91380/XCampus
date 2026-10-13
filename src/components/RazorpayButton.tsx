'use client';

import React, { useState } from 'react';
import { CreditCard, Sparkles, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface RazorpayButtonProps {
  packageId: string;
  packageName: string;
  priceInInr: number;
  credits: number;
  onSuccess?: (newBalance: number) => void;
  className?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function RazorpayButton({
  packageId,
  packageName,
  priceInInr,
  credits,
  onSuccess,
  className,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [sandboxOrderData, setSandboxOrderData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Create order on the server
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to initialize payment order');
      }

      // If Razorpay live/test keys are not provided and server is running in sandbox mode
      if (data.isSandbox) {
        setSandboxOrderData(data);
        setSandboxModalOpen(true);
        setLoading(false);
        return;
      }

      // If real Razorpay keys are configured, launch Razorpay standard popup
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'CampusConnect',
        description: `${packageName} (${credits} Chat Credits)`,
        order_id: data.razorpayOrderId,
        handler: async function (response: any) {
          // 2. Cryptographically verify signature on server
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              if (onSuccess) onSuccess(verifyData.newBalance);
              alert(`Payment successful! ${verifyData.creditsAdded} credits added to your account.`);
              window.location.reload();
            } else {
              alert(verifyData.message || 'Payment verification failed on server.');
            }
          } catch (err: any) {
            alert('Verification network error: ' + err.message);
          }
        },
        theme: {
          color: '#8B5CF6',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        alert('Payment failed: ' + resp.error.description);
      });
      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSandboxPayment = async () => {
    if (!sandboxOrderData) return;
    setLoading(true);

    try {
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: sandboxOrderData.orderId,
          razorpayOrderId: sandboxOrderData.razorpayOrderId,
          razorpayPaymentId: `pay_sandbox_${Date.now()}`,
          razorpaySignature: 'SANDBOX_LOCAL_VERIFIED',
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.success) {
        setSandboxModalOpen(false);
        if (onSuccess) onSuccess(verifyData.newBalance);
        alert(`Sandbox payment processed! ${verifyData.creditsAdded} credits credited.`);
        window.location.reload();
      } else {
        alert(verifyData.message || 'Verification error');
      }
    } catch (err: any) {
      alert('Error verifying sandbox payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleInitiatePayment}
        disabled={loading}
        className={
          className ||
          'w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-lg shadow-brand-purple/20 disabled:opacity-50'
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            <span>Buy for ₹{priceInInr}</span>
          </>
        )}
      </button>

      {errorMessage && (
        <p className="text-xs text-rose-400 mt-2 text-center">{errorMessage}</p>
      )}

      {/* Sandbox Test Mode Modal */}
      {sandboxModalOpen && sandboxOrderData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-brand-purple/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-fade-in">
            <div className="flex items-center gap-2.5 text-amber-400 mb-4 pb-3 border-b border-navy-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-bold text-sm tracking-wide">
                Razorpay Test Sandbox Simulation
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Your server does not currently have live or test Razorpay API keys configured in{' '}
              <code className="text-electric-400 bg-navy-950 px-1 py-0.5 rounded">.env.local</code>.
              To allow verifying the full user journey and auditable credit ledger without friction,
              you can simulate a confirmed test payment below.
            </p>

            <div className="bg-navy-950 rounded-xl p-4 border border-navy-800 text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">Package:</span>
                <span className="font-semibold text-white">{packageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Credits Granted:</span>
                <span className="font-semibold text-amber-400">+{credits} Credits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-semibold text-emerald-400">₹{priceInInr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Generated Order ID:</span>
                <span className="font-mono text-slate-400 text-[10px]">
                  {sandboxOrderData.razorpayOrderId}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSandboxModalOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-navy-700 text-slate-300 text-xs font-medium hover:bg-navy-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSandboxPayment}
                disabled={loading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Test Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
