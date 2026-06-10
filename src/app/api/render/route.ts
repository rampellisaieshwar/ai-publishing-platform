import { NextRequest, NextResponse } from 'next/server';
import { getBrowser } from '@/lib/puppeteer';
import { BASE_HTML_TEMPLATE } from '@/lib/template';
import { mergeEnhancementsToHtml } from '@/lib/parser';
import { JSDOM } from 'jsdom';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const { htmlContent, enhancements } = await req.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'Missing htmlContent parameter' }, { status: 400 });
    }

    let rawHtml = htmlContent;

    // 1. Merge AI enhancements if present
    if (enhancements) {
      console.log(`Merging AI enhancements in-memory`);
      rawHtml = mergeEnhancementsToHtml(rawHtml, enhancements);
    }

    // 2. Fetch logo for base64 encoding
    const logoUrl = 'https://anujjindal.in/wp-content/uploads/2022/05/LOGO-FULL-01.png';
    const headerLogoBase64 = await getBase64FromUrl(logoUrl);

    console.log('Resolving Puppeteer browser...');
    browser = await getBrowser();

    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.text()}`);
    });

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1
    });

    // 3. Construct final HTML payload by inserting rawHtml content into BASE_HTML_TEMPLATE
    const dom = new JSDOM(BASE_HTML_TEMPLATE);
    const doc = dom.window.document;
    
    // Inject clean content
    const contentRoot = doc.getElementById('content-root');
    const tempDiv = doc.createElement('div');
    tempDiv.innerHTML = rawHtml;

    const pageBody = tempDiv.querySelector('.page-body') || tempDiv.querySelector('body') || tempDiv;

    // Clean Notion TOC/header
    const toc = pageBody.querySelector('nav.table_of_contents');
    if (toc) toc.remove();

    const header = pageBody.querySelector('header');
    if (header) header.remove();

    // Setup column classifications
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
        contentRoot.appendChild(doc.importNode(child, true));
      }
    });

    const docTitle = tempDiv.querySelector('.page-title')?.textContent || 'Notes';
    const banner = doc.getElementById('banner-placeholder');
    if (banner) {
      banner.textContent = docTitle.toUpperCase();
    }

    const finalHtmlString = dom.serialize();

    console.log('Setting content in Puppeteer page...');
    await page.setContent(finalHtmlString, { waitUntil: 'load' });

    // Wait for image assets to load fully (base64 loads instantly, but standard URLs need loading)
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

    console.log('Printing PDF to buffer...');
    const pdfBuffer = await page.pdf({
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

    console.log('PDF generated successfully.');

    // Return the binary PDF stream directly to the client
    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
      },
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
