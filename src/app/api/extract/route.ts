import { NextRequest, NextResponse } from 'next/server';
import { parseHtmlToJSON } from '@/lib/parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Multipart form data required' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const documentId = crypto.randomUUID();
    const docDir = path.join(process.cwd(), 'public', 'temp', documentId);
    fs.mkdirSync(docDir, { recursive: true });

    let htmlContent = '';
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (file.name.endsWith('.zip')) {
      console.log(`Extracting ZIP file: ${file.name}`);
      const zip = new AdmZip(fileBuffer);
      zip.extractAllTo(docDir, true);

      // Search for the HTML file at the root level of extraction
      const files = fs.readdirSync(docDir);
      let htmlFile = files.find(f => f.endsWith('.html') || f.endsWith('.htm'));

      // If not at root, check one level deep inside folder
      if (!htmlFile) {
        for (const item of files) {
          const itemPath = path.join(docDir, item);
          if (fs.statSync(itemPath).isDirectory()) {
            const subFiles = fs.readdirSync(itemPath);
            const subHtml = subFiles.find(f => f.endsWith('.html') || f.endsWith('.htm'));
            if (subHtml) {
              htmlFile = path.join(item, subHtml);
              break;
            }
          }
        }
      }

      if (!htmlFile) {
        return NextResponse.json({ error: 'No HTML file found inside ZIP archive' }, { status: 400 });
      }

      const originalHtmlPath = path.join(docDir, htmlFile);
      htmlContent = fs.readFileSync(originalHtmlPath, 'utf8');

      // Normalize it to index.html at root
      if (htmlFile !== 'index.html') {
        fs.writeFileSync(path.join(docDir, 'index.html'), htmlContent, 'utf8');
      }
    } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      console.log(`Writing HTML file: ${file.name}`);
      htmlContent = fileBuffer.toString('utf8');
      fs.writeFileSync(path.join(docDir, 'index.html'), htmlContent, 'utf8');
    } else {
      return NextResponse.json({ error: 'Only HTML or ZIP files are supported' }, { status: 400 });
    }

    const doc = parseHtmlToJSON(htmlContent);
    return NextResponse.json({
      documentId,
      title: doc.title,
      blocks: doc.blocks
    });
  } catch (error: any) {
    console.error('Error in /api/extract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
