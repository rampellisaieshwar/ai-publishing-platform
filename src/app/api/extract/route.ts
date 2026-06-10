import { NextRequest, NextResponse } from 'next/server';
import { parseHtmlToJSON } from '@/lib/parser';
import * as cheerio from 'cheerio';
import path from 'path';
import AdmZip from 'adm-zip';

export const runtime = 'nodejs';
export const maxDuration = 60;

function toDriveDirectDownloadUrl(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'drive.google.com') {
      return inputUrl;
    }

    const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (pathMatch?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${pathMatch[1]}&confirm=t`;
    }

    const queryId = parsed.searchParams.get('id');
    if (queryId) {
      return `https://drive.google.com/uc?export=download&id=${queryId}&confirm=t`;
    }

    return inputUrl;
  } catch {
    return inputUrl;
  }
}

function detectFileKind(name: string, contentType: string): 'zip' | 'html' | null {
  const lowerName = name.toLowerCase();
  const lowerType = contentType.toLowerCase();

  if (
    lowerName.endsWith('.zip') ||
    lowerType.includes('application/zip') ||
    lowerType.includes('application/x-zip-compressed')
  ) {
    return 'zip';
  }

  if (
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerType.includes('text/html')
  ) {
    return 'html';
  }

  return null;
}

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

    let htmlContent = '';
    let inputName = '';
    let fileBuffer: Buffer | null = null;
    let fileKind: 'zip' | 'html' | null = null;

    const file = formData.get('file');
    const fileUrlRaw = formData.get('fileUrl');

    if (file && file instanceof File) {
      inputName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileKind = detectFileKind(file.name, file.type || '');
    } else if (typeof fileUrlRaw === 'string' && fileUrlRaw.trim()) {
      const normalizedUrl = toDriveDirectDownloadUrl(fileUrlRaw.trim());
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(normalizedUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid file URL provided' }, { status: 400 });
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
      }

      const remoteRes = await fetch(parsedUrl.toString(), {
        redirect: 'follow',
      });

      if (!remoteRes.ok) {
        return NextResponse.json(
          { error: `Failed to download file URL (HTTP ${remoteRes.status})` },
          { status: 400 }
        );
      }

      const contentType = remoteRes.headers.get('content-type') || '';
      const disposition = remoteRes.headers.get('content-disposition') || '';
      const dispositionNameMatch = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
      const dispositionName = dispositionNameMatch?.[1] ? decodeURIComponent(dispositionNameMatch[1]) : '';
      const pathnameName = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'remote-file');
      inputName = dispositionName || pathnameName || 'remote-file';

      const remoteBuffer = await remoteRes.arrayBuffer();
      fileBuffer = Buffer.from(remoteBuffer);
      fileKind = detectFileKind(inputName, contentType);

      if (!fileKind) {
        // Fallback by ZIP signature (PK\x03\x04)
        if (fileBuffer.length >= 4 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b) {
          fileKind = 'zip';
          inputName = inputName.endsWith('.zip') ? inputName : `${inputName}.zip`;
        }
      }
    } else {
      return NextResponse.json({ error: 'No file or file URL provided' }, { status: 400 });
    }

    if (!fileBuffer || !fileKind) {
      return NextResponse.json({ error: 'Only HTML or ZIP files are supported' }, { status: 400 });
    }

    if (fileKind === 'zip') {
      console.log(`Extracting ZIP file in-memory: ${inputName}`);
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
      const $ = cheerio.load(htmlContent);

      $('img').each((_, imgEl) => {
        const img = $(imgEl);
        const src = img.attr('src');
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
            img.attr('src', `data:${mimeType};base64,${base64}`);
            console.log(`[ZIP INLINE IMAGE] Inlined ${imgEntry.entryName}`);
          }
        }
      });

      htmlContent = $.html();
    } else if (fileKind === 'html') {
      console.log(`Reading HTML file: ${inputName}`);
      htmlContent = fileBuffer.toString('utf8');
      
      // If running locally, check if we can read the referenced local images from disk
      // and inline them to base64. This makes standalone HTML uploads with local images work.
      const isLocal = process.env.NODE_ENV === 'development' || process.env.VERCEL !== '1';
      if (isLocal) {
        console.log('Running locally: attempting to resolve local image links from local Downloads fallback');
        const $ = cheerio.load(htmlContent);
        const fs = await import('fs');
        const path = await import('path');

        $('img').each((_, imgEl) => {
          const img = $(imgEl);
          const src = img.attr('src');
          if (src && !src.startsWith('http') && !src.startsWith('data:')) {
            const decodedSrc = decodeURIComponent(src);
            const pathsToTry = [
              path.join('/Users/saieshwarrampelli/Downloads/Anuj Jindal Task', decodedSrc),
              path.join('/Users/saieshwarrampelli/Downloads/LevelUp/AJCeduttech', decodedSrc),
              path.join('/Users/saieshwarrampelli/Downloads', decodedSrc),
            ];

            for (const localPath of pathsToTry) {
              if (fs.existsSync(localPath)) {
                try {
                  const ext = path.extname(localPath).toLowerCase().replace('.', '');
                  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                  const imgBuffer = fs.readFileSync(localPath);
                  const base64 = imgBuffer.toString('base64');
                  img.attr('src', `data:${mimeType};base64,${base64}`);
                  console.log(`[LOCAL FALLBACK IMAGE] Inlined: ${localPath}`);
                  break;
                } catch (e: any) {
                  console.warn(`Failed to read local fallback image: ${localPath}`, e.message);
                }
              }
            }
          }
        });
        htmlContent = $.html();
      }
    }

    const doc = parseHtmlToJSON(htmlContent);
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
