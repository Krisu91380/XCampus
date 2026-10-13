'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  UserCheck,
  Info,
} from 'lucide-react';

interface QRCodeCheckoutModalProps {
  packageId: string;
  packageName: string;
  priceInInr: number;
  credits: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

export default function QRCodeCheckoutModal({
  packageId,
  packageName,
  priceInInr,
  credits,
  isOpen,
  onClose,
  onSuccess,
}: QRCodeCheckoutModalProps) {
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    'AWAITING' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'FAILED'
  >('AWAITING');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900); // 15-minute window
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedBalance, setVerifiedBalance] = useState<number | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Order & QR Code on Open
  useEffect(() => {
    if (!isOpen) {
      setOrderData(null);
      setPaymentStatus('AWAITING');
      setErrorMessage(null);
      setSubmittingPayment(false);
      setRejectionReason(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setPaymentStatus('AWAITING');
    setTimeLeftSeconds(900);
    setErrorMessage(null);
    setSubmittingPayment(false);
    setRejectionReason(null);

    const initOrder = async () => {
      try {
        const res = await fetch('/api/payments/create-qr-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to create payment order');
        }

        if (isMounted) {
          setOrderData(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message);
          setLoading(false);
        }
      }
    };

    initOrder();

    return () => {
      isMounted = false;
    };
  }, [isOpen, packageId]);

  // Countdown Timer
  useEffect(() => {
    if (!isOpen || (paymentStatus !== 'AWAITING' && paymentStatus !== 'PENDING_VERIFICATION')) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (paymentStatus === 'AWAITING') {
            setPaymentStatus('FAILED');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, paymentStatus]);

  // Live Order Status Polling (Every 2.5 seconds)
  useEffect(() => {
    if (!isOpen || !orderData?.orderId) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    if (
      paymentStatus === 'PAID' ||
      paymentStatus === 'REJECTED' ||
      paymentStatus === 'CANCELLED' ||
      paymentStatus === 'FAILED'
    ) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/order-status?orderId=${orderData.orderId}`);
        const data = await res.json();

        if (data.success) {
          if (data.status === 'PAID') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentStatus('PAID');
            setVerifiedBalance(data.currentBalance);
            onSuccess(data.currentBalance);
          } else if (data.status === 'REJECTED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentStatus('REJECTED');
            setRejectionReason(data.rejectionReason || 'Payment could not be verified in UPI account.');
          } else if (data.status === 'PENDING_VERIFICATION') {
            setPaymentStatus('PENDING_VERIFICATION');
          } else if (data.status === 'CANCELLED' || data.status === 'FAILED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPaymentStatus(data.status);
          }
        }
      } catch {
        // Network retry
      }
    }, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, orderData, paymentStatus, onSuccess]);

  const handleCancelPayment = async () => {
    if (orderData?.orderId) {
      try {
        await fetch('/api/payments/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderData.orderId }),
        });
      } catch {}
    }
    setPaymentStatus('CANCELLED');
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleCopyVpa = () => {
    const vpa = orderData?.merchantVpa || orderData?.upiId;
    if (vpa) {
      navigator.clipboard.writeText(vpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    }
  };

  const handleCopyRef = () => {
    const ref = orderData?.razorpayOrderId;
    if (ref) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  // Simplified "I have paid" submission
  const handleIHavePaid = async () => {
    if (!orderData?.orderId || submittingPayment) return;

    setSubmittingPayment(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/payments/submit-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit payment confirmation');
      }

      setPaymentStatus('PENDING_VERIFICATION');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting payment confirmation');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const qrImageToDisplay = orderData?.customQrImageUrl || orderData?.qrCodeDataUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto bg-navy-900 border border-navy-750 rounded-3xl shadow-2xl shadow-navy-950/90 overflow-hidden text-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 bg-navy-850/70">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-brand-purple" />
            <div>
              <h3 className="text-sm font-bold text-white">UPI QR Payment Gate</h3>
              <p className="text-[10px] text-slate-400">Direct UPI Scan & Pay</p>
            </div>
          </div>
          {paymentStatus !== 'PAID' && (
            <button
              onClick={handleCancelPayment}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
              title="Close payment window"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-brand-purple mx-auto" />
              <p className="text-xs text-slate-400">Loading payment gateway & QR code...</p>
            </div>
          ) : errorMessage ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Payment Issue</h4>
              <p className="text-xs text-rose-300 max-w-xs mx-auto">{errorMessage}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          ) : paymentStatus === 'PAID' ? (
            /* SUCCESS STATE */
            <div className="py-6 text-center space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wide uppercase mb-2">
                  Payment Verified & Approved
                </span>
                <h4 className="text-2xl font-extrabold text-white">Credits Added!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Successfully activated <strong>{orderData?.packageName}</strong>.
                </p>
              </div>

              {/* Receipt Summary Box */}
              <div className="p-4 rounded-2xl bg-navy-850 border border-navy-750 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">Credits Granted:</span>
                  <span className="font-bold text-emerald-400 font-mono">+{orderData?.credits} Credits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-bold text-white">₹{orderData?.amountInInr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Updated Balance:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {verifiedBalance !== null ? `${verifiedBalance} Credits` : 'Updated'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-navy-800 text-[10px] text-slate-500 font-mono">
                  <span>Order Ref:</span>
                  <span className="truncate max-w-[180px]">{orderData?.razorpayOrderId}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    onClose();
                    window.location.href = '/match';
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-lg shadow-brand-purple/25 hover:opacity-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Chatting Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : paymentStatus === 'REJECTED' ? (
            /* REJECTED STATE */
            <div className="py-8 text-center space-y-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/10">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">Payment Verification Rejected</h4>
              <p className="text-xs text-rose-300 max-w-sm mx-auto">
                {rejectionReason || 'The administrator could not verify this payment in their bank or UPI account.'}
              </p>
              <div className="p-3 bg-navy-850 rounded-xl border border-navy-750 text-left text-xs text-slate-400">
                <p className="text-[11px] text-slate-300 font-semibold mb-1">Notice</p>
                <p className="text-[10px]">
                  Zero credits were deducted or added. If you were debited, please contact the administrator with your transaction details.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentStatus('AWAITING')}
                  className="flex-1 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-navy-750 text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          ) : paymentStatus === 'CANCELLED' || paymentStatus === 'FAILED' ? (
            /* CANCELLED / EXPIRED STATE */
            <div className="py-8 text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">
                {paymentStatus === 'CANCELLED' ? 'Payment Cancelled' : 'Payment Expired'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {paymentStatus === 'CANCELLED'
                  ? 'The transaction was cancelled. Zero credits were added.'
                  : 'The payment window has expired. No charges were made.'}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-white"
              >
                Return to Pricing
              </button>
            </div>
          ) : (
            /* ACTIVE PAYMENT SCREEN (AWAITING or PENDING_VERIFICATION) */
            <div className="space-y-4">
              {/* Package Details Header */}
              <div className="flex items-center justify-between pb-3 border-b border-navy-800">
                <div>
                  <h4 className="font-bold text-white text-sm">{orderData?.packageName}</h4>
                  <p className="text-[11px] text-slate-400">
                    {orderData?.credits} Chat Pass Credits
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-white">₹{orderData?.amountInInr}</span>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase">Exact Amount</p>
                </div>
              </div>

              {/* Status Banner */}
              {paymentStatus === 'PENDING_VERIFICATION' ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="font-bold text-amber-300 text-xs">
                      Awaiting Administrator Verification
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-4.5">
                    Your payment confirmation has been submitted to the administrator for review. Credits will be credited automatically once verified.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span className="font-semibold text-purple-300 text-[11px]">Awaiting Payment</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time left: {formatTimer(timeLeftSeconds)}</span>
                  </div>
                </div>
              )}

              {/* QR Code Presentation Box */}
              <div className="p-4 bg-white rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-black/20 text-center">
                {qrImageToDisplay ? (
                  <img
                    src={qrImageToDisplay}
                    alt="UPI Payment QR Code"
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                    SCAN TO PAY ₹{orderData?.amountInInr}
                  </p>
                  <p className="text-[11px] font-semibold text-brand-purple">
                    Receiver: {orderData?.receiverName || 'KRISH SO ANIL KUMAR'}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    PhonePe • Google Pay • Paytm • BHIM • Navi
                  </p>
                </div>
              </div>

              {/* Receiver & Order Details */}
              <div className="space-y-2 text-xs">
                {/* Receiver Info */}
                <div className="p-3 rounded-xl bg-navy-850 border border-navy-750 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-electric-400" />
                      Payment Receiver:
                    </span>
                    <span className="font-bold text-white text-xs block">
                      {orderData?.receiverName || 'KRISH SO ANIL KUMAR'}
                    </span>
                  </div>
                  {orderData?.merchantVpa && (
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="px-2 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                    >
                      {copiedVpa ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedVpa ? 'Copied' : 'Copy UPI'}</span>
                    </button>
                  )}
                </div>

                {/* Order Reference */}
                <div className="p-3 rounded-xl bg-navy-850 border border-navy-750 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Order Reference:</span>
                    <span className="font-mono text-xs text-slate-200 block truncate max-w-[240px]">
                      {orderData?.razorpayOrderId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="px-2 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                  >
                    {copiedRef ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Instructions */}
                {orderData?.instructions && (
                  <div className="p-3 rounded-xl bg-navy-950/60 border border-navy-800 text-[11px] text-slate-400 whitespace-pre-line leading-relaxed">
                    <div className="flex items-center gap-1.5 font-bold text-slate-300 mb-1 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-brand-purple" />
                      <span>Payment Instructions:</span>
                    </div>
                    {orderData.instructions}
                  </div>
                )}
              </div>

              {/* Action Buttons: "I have paid" & "Cancel" */}
              <div className="pt-2 space-y-2">
                {paymentStatus !== 'PENDING_VERIFICATION' ? (
                  <button
                    type="button"
                    onClick={handleIHavePaid}
                    disabled={submittingPayment}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-electric-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {submittingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Notifying Administrator...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>I have paid ₹{orderData?.amountInInr}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-navy-850 border border-navy-750 text-center text-xs text-amber-300 flex items-center justify-center gap-2 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Awaiting administrator verification...</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCancelPayment}
                  className="w-full py-2.5 rounded-xl border border-navy-750 hover:bg-navy-850 text-xs text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Cancel Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
