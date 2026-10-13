import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
    }

    // Validate mime type: PNG, JPEG, WebP
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Allowed formats: PNG, JPG, WebP.' },
        { status: 400 }
      );
    }

    // Validate size: max 5MB
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum allowed size is 5MB.' },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || '.png';
    const filename = `custom_qr_${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let publicUrl = `/uploads/payment/${filename}`;

    // Save to local disk if writable; fallback to Base64 data URI on read-only serverless (Vercel)
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'payment');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
    } catch {
      publicUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    }

    await logAdminAction({
      adminId: session.userId,
      action: 'PAYMENT_QR_UPLOADED',
      targetType: 'PaymentSettings',
      targetId: 'qr-image',
      details: { filename, size: file.size, type: file.type },
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileUrl: publicUrl,
      message: 'QR Code image uploaded successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message?.includes('Admin')) {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 403 });
    }
    console.error('QR upload error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
