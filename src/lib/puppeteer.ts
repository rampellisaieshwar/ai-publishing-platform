import puppeteer from 'puppeteer-core';

export async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  if (isProduction) {
    console.log('Launching browser in PRODUCTION mode using @sparticuz/chromium-min...');
    const chromium = (await import('@sparticuz/chromium-min')).default;
    
    // We configure the executable path to point to a reliable, matching remote binary release.
    const executablePath = await chromium.executablePath(
      'https://github.com/sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    );
    
    console.log('Executable path resolved:', executablePath);

    return puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath,
      headless: true,
    });
  } else {
    console.log('Launching browser in DEVELOPMENT mode using local Chrome...');
    const fs = await import('fs');
    const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    let executablePath = '';
    if (fs.existsSync(macChromePath)) {
      executablePath = macChromePath;
    } else {
      executablePath = '/usr/bin/google-chrome';
    }
    
    console.log('Using executable path:', executablePath);

    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
      headless: true,
    });
  }
}
