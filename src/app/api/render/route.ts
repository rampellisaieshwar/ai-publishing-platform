import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { BASE_HTML_TEMPLATE } from '@/lib/template';
import { mergeEnhancementsToHtml } from '@/lib/parser';
import { JSDOM } from 'jsdom';

async function getBase64FromUrl(url: string): Promise<string> {
  try {
    console.log(`Fetching logo for base64: ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err: any) {
    console.warn('Failed to fetch logo for base64, using raw URL instead:', err.message);
    return url;
  }
}

export async function POST(req: NextRequest) {
  let browser;
  try {
    const { documentId, enhancements } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    const docDir = path.join(process.cwd(), 'public', 'temp', documentId);
    const htmlPath = path.join(docDir, 'index.html');

    if (!fs.existsSync(htmlPath)) {
      return NextResponse.json({ error: 'Uploaded document not found' }, { status: 404 });
    }

    let rawHtml = fs.readFileSync(htmlPath, 'utf8');

    // 1. Merge AI enhancements if present
    if (enhancements) {
      console.log(`Merging AI enhancements for document ${documentId}`);
      rawHtml = mergeEnhancementsToHtml(rawHtml, enhancements);
    }

    // 2. Resolve relative image paths on the Node side using fs checks
    const dom = new JSDOM(rawHtml);
    const doc = dom.window.document;
    const pageBody = doc.querySelector('.page-body') || doc.querySelector('body') || doc;

    const images = pageBody.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('file://') && !src.startsWith('data:')) {
        const decodedSrc = decodeURIComponent(src);
        const localPath = path.join(docDir, decodedSrc);
        const fallbackPath = path.join('/Users/saieshwarrampelli/Downloads/Anuj Jindal Task', decodedSrc);

        if (fs.existsSync(localPath)) {
          img.setAttribute('src', `file://${localPath}`);
          console.log(`[RESOLVE IMAGE] Local: file://${localPath}`);
        } else if (fs.existsSync(fallbackPath)) {
          img.setAttribute('src', `file://${fallbackPath}`);
          console.log(`[RESOLVE IMAGE] Fallback: file://${fallbackPath}`);
        } else {
          // If neither exists, write localPath as default
          img.setAttribute('src', `file://${localPath}`);
          console.log(`[RESOLVE IMAGE] Not found on disk, default to local: file://${localPath}`);
        }
      }
    });

    const serializedHtml = dom.serialize();
    fs.writeFileSync(path.join(docDir, 'rendered.html'), serializedHtml, 'utf8');

    // 3. Write template.html on the fly to support file:// origin and satisfy browser sandbox
    const templatePath = path.join(docDir, 'template.html');
    fs.writeFileSync(templatePath, BASE_HTML_TEMPLATE, 'utf8');

    // 4. Fetch logo for base64 encoding
    const logoUrl = 'https://anujjindal.in/wp-content/uploads/2022/05/LOGO-FULL-01.png';
    const headerLogoBase64 = await getBase64FromUrl(logoUrl);

    console.log('Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.text()}`);
    });

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1
    });

    console.log(`Loading template: file://${templatePath}`);
    await page.goto(`file://${templatePath}`, { waitUntil: 'load' });

    // Inject the resolved HTML and run table layout classifications
    await page.evaluate((htmlContent) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      const pageBody = tempDiv.querySelector('.page-body') || tempDiv.querySelector('body') || tempDiv;

      // Clean Notion TOC/header
      const toc = pageBody.querySelector('nav.table_of_contents');
      if (toc) toc.remove();

      const header = pageBody.querySelector('header');
      if (header) header.remove();

      const contentRoot = document.getElementById('content-root');
      if (contentRoot) {
        contentRoot.innerHTML = '';
      }

      function getClassifierTarget(el: Element): Element | null {
        if (!el) return null;
        if (el.tagName === 'TABLE' || el.classList.contains('simple-table')) {
          return el;
        }
        if (el.tagName === 'FIGURE' && el.classList.contains('image')) {
          return el;
        }
        if (el.tagName === 'IMG') {
          return el;
        }
        
        const table = el.querySelector('table, .simple-table');
        if (table) return table;

        const img = el.querySelector('figure.image, img');
        if (img) return img;
        
        if (el.tagName === 'DIV' && el.firstElementChild) {
          return getClassifierTarget(el.firstElementChild);
        }
        
        return el;
      }

      function classifyElement(el: Element) {
        const target = getClassifierTarget(el);
        if (!target) return;
        
        if (target.tagName === 'TABLE' || target.classList.contains('simple-table')) {
          const firstRow = target.querySelector('tr');
          const cols = firstRow ? firstRow.querySelectorAll('th, td').length : 0;
          const textLength = target.textContent ? target.textContent.length : 0;
          
          if (cols <= 3 && textLength < 300) {
            target.classList.add('small-table');
          } else {
            target.classList.add('wide-table');
          }
        }
      }

      const children = Array.from(pageBody.children);
      children.forEach(child => {
        classifyElement(child);
        if (contentRoot) {
          contentRoot.appendChild(child);
        }
      });

      const docTitle = tempDiv.querySelector('.page-title')?.textContent || 'Notes';
      const banner = document.getElementById('banner-placeholder');
      if (banner) {
        banner.textContent = docTitle.toUpperCase();
      }
    }, serializedHtml);

    // Wait for image assets to load fully
    console.log('Waiting for images and fonts to load...');
    await page.evaluate(async () => {
      const imageElements = Array.from(document.querySelectorAll('img'));
      await Promise.all(imageElements.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      }));

      await document.fonts.ready;
    });

    const pdfPath = path.join(docDir, 'output.pdf');
    console.log(`Printing A4 PDF: ${pdfPath}`);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 15px 36px 5px 36px; border-bottom: 1px solid #E2E8F0; color: #64748B; -webkit-print-color-adjust: exact;">
          <div>
            <img src="${headerLogoBase64}" style="height: 18px; width: auto; display: block; object-fit: contain;">
          </div>
          <div style="font-weight: 700; text-transform: uppercase; color: #1B71AC; letter-spacing: 0.5px;">
            Economic and Social Issues &nbsp;|&nbsp; Economic Growth and Development
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 8px; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 5px 36px 15px 36px; border-top: 1px solid #E2E8F0; color: #64748B; -webkit-print-color-adjust: exact;">
          <div style="font-weight: 600;">+91 9999466225</div>
          <div style="font-weight: 700; color: #1B71AC; text-decoration: none;">www.anujjindal.in</div>
          <div style="background-color: #2AB573; color: #FFFFFF; padding: 2px 6px; font-weight: 700; font-size: 8px; border-radius: 2px;">
            <span class="pageNumber"></span>
          </div>
        </div>
      `,
      margin: {
        top: '65px',
        bottom: '50px',
        left: '36px',
        right: '36px'
      }
    });

    console.log('PDF rendered successfully.');
    return NextResponse.json({
      success: true,
      pdfUrl: `/temp/${documentId}/output.pdf`
    });

  } catch (error: any) {
    console.error('Error in /api/render:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
