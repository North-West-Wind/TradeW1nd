import puppeteer from 'puppeteer-core';
let browser: puppeteer.Browser, timeout: NodeJS.Timeout;

async function getBrowser() {
    if (!browser) browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu', "--proxy-server='direct://'", '--proxy-bypass-list=*'],
      headless: true,
      executablePath: process.env.CHROMIUM
    });
    return browser;
}

export async function run(cb: Function) {
    try {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        const b = await getBrowser();
        const page = await b.newPage();
        const result = await cb(page);
        page?.close();
        timeout = setTimeout(() => {
            browser?.close();
            browser = undefined;
        }, 10000);
        return result;
    } catch (err: any) {
        return err;
    }
}