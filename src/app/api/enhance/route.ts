import { NextRequest, NextResponse } from 'next/server';
import { enhanceDocument } from '@/lib/ai';
import { parseHtmlToJSON } from '@/lib/parser';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { doc, documentId, flags } = await req.json();
    if (!flags) {
      return NextResponse.json({ error: 'Missing flags parameter' }, { status: 400 });
    }

    let structuredDoc = doc;

    if (documentId && !doc) {
      const htmlPath = path.join(process.cwd(), 'public', 'temp', documentId, 'index.html');
      if (!fs.existsSync(htmlPath)) {
        return NextResponse.json({ error: 'Document not found on disk' }, { status: 404 });
      }
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      structuredDoc = parseHtmlToJSON(htmlContent);
    }

    if (!structuredDoc || !structuredDoc.blocks) {
      return NextResponse.json({ error: 'Missing document parameters' }, { status: 400 });
    }

    const enhancements = await enhanceDocument(structuredDoc, flags);
    return NextResponse.json(enhancements);
  } catch (error: any) {
    console.error('Error in /api/enhance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
