import { NextRequest, NextResponse } from 'next/server';
// Note: `jsdom` and `parseHtmlToJSON` are imported dynamically inside the
// request handler to avoid ESM/CJS loading issues in some serverless runtimes.
import path from 'path';
import AdmZip from 'adm-zip';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError: any) {
      console.error('FormData parsing error:', formError);
      return NextResponse.json(
        { error: 'Failed to parse file upload. Please try again.' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    let htmlContent = '';
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (file.name.endsWith('.zip')) {
      console.log(`Extracting ZIP file in-memory: ${file.name}`);
      const zip = new AdmZip(fileBuffer);
      const zipEntries = zip.getEntries();

      // Find the main HTML file (either at root or one level deep)
      let htmlEntry = zipEntries.find(entry => 
        !entry.isDirectory && (entry.entryName.endsWith('.html') || entry.entryName.endsWith('.htm'))
      );

      if (!htmlEntry) {
        return NextResponse.json({ error: 'No HTML file found inside ZIP archive' }, { status: 400 });
      }

      htmlContent = htmlEntry.getData().toString('utf8');

      // Parse HTML to resolve and inline image attachments
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(htmlContent);
      const doc = dom.window.document;
      const images = doc.querySelectorAll('img');

      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          const decodedSrc = decodeURIComponent(src);
          // Try matching entry names inside the zip archive
          let imgEntry = zipEntries.find(entry => {
            const entryPath = entry.entryName;
            return entryPath === decodedSrc || 
                   entryPath.endsWith('/' + decodedSrc) ||
                   entryPath === decodedSrc.replace(/^\.\//, '');
          });

          if (imgEntry && !imgEntry.isDirectory) {
            const ext = path.extname(imgEntry.entryName).toLowerCase().replace('.', '');
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            const imgBuffer = imgEntry.getData();
            const base64 = imgBuffer.toString('base64');
            img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            console.log(`[ZIP INLINE IMAGE] Inlined ${imgEntry.entryName}`);
          }
        }
      });

      htmlContent = dom.serialize();
    } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      console.log(`Reading HTML file: ${file.name}`);
      htmlContent = fileBuffer.toString('utf8');
      
      // For standalone HTML files, we also parse it to check for external image paths.
      // If there are relative image paths, we leave them or warn since there's no ZIP directory.
    } else {
      return NextResponse.json({ error: 'Only HTML or ZIP files are supported' }, { status: 400 });
    }

    const { parseHtmlToJSON } = await import('@/lib/parser');
    const doc = await parseHtmlToJSON(htmlContent);
    return NextResponse.json({
      title: doc.title,
      blocks: doc.blocks,
      htmlContent
    });
  } catch (error: any) {
    console.error('Error in /api/extract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
