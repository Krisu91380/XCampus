import fs from 'fs';
import path from 'path';

export interface PaymentSettings {
  isEnabled: boolean;
  receiverName: string;
  upiId?: string;
  qrImageUrl: string;
  instructions: string;
  updatedAt: string;
  updatedBy?: string;
}

const LOCAL_SETTINGS_FILE = path.join(process.cwd(), 'prisma', 'payment_settings.json');
const TMP_SETTINGS_FILE = '/tmp/payment_settings.json';

const DEFAULT_SETTINGS: PaymentSettings = {
  isEnabled: true,
  receiverName: 'KRISH SO ANIL KUMAR',
  upiId: '9138060466@naviaxis',
  qrImageUrl: '/uploads/payment/custom_qr.png',
  instructions:
    '1. Scan the QR code using Google Pay, PhonePe, Paytm, Navi, or any UPI app.\n2. Pay the exact package amount shown above.\n3. Copy the 12-digit UTR / Transaction Reference Number from your payment app.\n4. Submit the reference number below for instant administrative verification.',
  updatedAt: new Date().toISOString(),
};

export function getPaymentSettings(): PaymentSettings {
  try {
    if (process.env.VERCEL && fs.existsSync(TMP_SETTINGS_FILE)) {
      const data = fs.readFileSync(TMP_SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const data = fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading payment settings:', err);
  }
  return DEFAULT_SETTINGS;
}

export function savePaymentSettings(settings: Partial<PaymentSettings>, updatedBy?: string): PaymentSettings {
  const current = getPaymentSettings();
  const updated: PaymentSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy,
  };

  try {
    if (process.env.VERCEL) {
      fs.writeFileSync(TMP_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    } else {
      const dir = path.dirname(LOCAL_SETTINGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    }
  } catch {
    try {
      fs.writeFileSync(TMP_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    } catch {}
  }

  return updated;
}
