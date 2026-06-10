import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const id = slug[0];
    const pdfPath = path.join(process.cwd(), 'public', 'temp', id, 'output.pdf');
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    let title = 'study-guide';
    const metadataPath = path.join(process.cwd(), 'public', 'temp', id, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        if (metadata.title) {
          title = metadata.title.replace(/[^a-zA-Z0-9-_]/g, '_');
        }
      } catch (e) {
        console.warn('Error reading metadata for download filename:', e);
      }
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/download:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
