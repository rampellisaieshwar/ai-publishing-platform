import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument } from '@/lib/ai';
import { StructuredDocument } from '@/lib/parser';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const doc = (await req.json()) as StructuredDocument & { documentId?: string };
    if (!doc || !doc.blocks) {
      return NextResponse.json({ error: 'Invalid document structure' }, { status: 400 });
    }

    let wordCount = 0;
    let headingCount = 0;
    let tableCount = 0;
    let imageCount = 0;

    for (const block of doc.blocks) {
      if (block.type === 'heading') headingCount++;
      if (block.type === 'table') tableCount++;
      if (block.type === 'image') imageCount++;

      if (block.text) {
        wordCount += block.text.trim().split(/\s+/).filter(Boolean).length;
      }
    }

    const estimatedReadingTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;
    const aiAnalysis = await analyzeDocument(doc);

    const statsResult = {
      title: doc.title,
      wordCount,
      estimatedReadingTime,
      headings: headingCount,
      tables: tableCount,
      images: imageCount,
      ...aiAnalysis
    };

    // If documentId is present, persist the metadata to disk for statically loading on preview
    if (doc.documentId) {
      const docDir = path.join(process.cwd(), 'public', 'temp', doc.documentId);
      if (fs.existsSync(docDir)) {
        fs.writeFileSync(
          path.join(docDir, 'metadata.json'),
          JSON.stringify(statsResult, null, 2),
          'utf8'
        );
      }
    }

    return NextResponse.json(statsResult);
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
