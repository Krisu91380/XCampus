import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Please upload a PNG, JPG, or WebP screenshot.' },
        { status: 400 }
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, message: 'Screenshot too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || '.png';
    const filename = `receipt_${session.userId.substring(0, 8)}_${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let publicUrl = `/uploads/receipts/${filename}`;

    // Save to local disk if writable; fallback to Base64 data URI on read-only serverless (Vercel)
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
    } catch {
      publicUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileUrl: publicUrl,
      message: 'Receipt uploaded successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Receipt upload error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
