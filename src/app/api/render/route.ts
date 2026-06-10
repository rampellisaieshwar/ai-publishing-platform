import { NextRequest, NextResponse } from 'next/server';
import { getBrowser } from '@/lib/puppeteer';
import { BASE_HTML_TEMPLATE } from '@/lib/template';
import { mergeEnhancementsToHtml } from '@/lib/parser';
import * as cheerio from 'cheerio';

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
    const $ = cheerio.load(BASE_HTML_TEMPLATE);
    const contentRoot = $('#content-root');

    // Parse the rawHtml
    const $raw = cheerio.load(rawHtml);

    // Clean Notion TOC/header
    $raw('nav.table_of_contents').remove();
    $raw('header').remove();

    const pageBody = ($raw('.page-body').length ? $raw('.page-body') : $raw('body').length ? $raw('body') : $raw.root()) as any;

    // Setup column classifications
    function getClassifierTarget(el: any): any | null {
      if (!el.length) return null;
      if (el.is('table') || el.hasClass('simple-table')) {
        return el;
      }
      if (el.is('figure') && el.hasClass('image')) {
        return el;
      }
      if (el.is('img')) {
        return el;
      }
      
      const table = el.find('table, .simple-table');
      if (table.length) return table.first();

      const img = el.find('figure.image, img');
      if (img.length) return img.first();
      
      if (el.is('div') && el.children().length > 0) {
        return getClassifierTarget(el.children().first());
      }
      
      return el;
    }

    function classifyElement(el: any) {
      const target = getClassifierTarget(el);
      if (!target || !target.length) return;
      
      if (target.is('table') || target.hasClass('simple-table')) {
        const firstRow = target.find('tr').first();
        const cols = firstRow.find('th, td').length;
        const textLength = target.text().length;
        
        if (cols <= 3 && textLength < 300) {
          target.addClass('small-table');
        } else {
          target.addClass('wide-table');
        }
      }
    }

    // Classify elements and append to container template
    pageBody.children().each((_: any, childEl: any) => {
      const child = $raw(childEl) as any;
      classifyElement(child);
      contentRoot.append(child);
    });

    const docTitle = $raw('.page-title').text() || 'Notes';
    const banner = $('#banner-placeholder');
    if (banner.length) {
      banner.text(docTitle.toUpperCase());
    }

    const finalHtmlString = $.html();

    console.log('Setting content in Puppeteer page...');
    await page.setContent(finalHtmlString, { waitUntil: 'load' });

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
