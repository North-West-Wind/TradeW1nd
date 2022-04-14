import { run } from "./puppeteer.js";
import { Page } from 'puppeteer-core';

export async function getMP3(url: string): Promise<{ error: boolean, url: string, message: string, timeTaken: number }> {
    return await run(async (page: Page) => {
        var result = { error: true, url: undefined, message: undefined, timeTaken: 0 };
        const start = Date.now();
        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36');
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (["image", "font", "stylesheet", "media"].includes(req.resourceType())) req.abort();
                else req.continue();
            });
            await page.goto(url, { waitUntil: "domcontentloaded" });
            await page.waitForSelector("circle, button[title='Toggle Play']").then(el => el.click());
            const mp3 = await page.waitForRequest(req => req.url()?.startsWith("https://s3.ultimate-guitar.com/") || req.url()?.startsWith("https://www.youtube.com/embed/"));
            result.url = mp3.url();
            result.error = false;
        } catch (err: any) {
            result.message = err.message;
        } finally {
            result.timeTaken = Date.now() - start;
            return result;
        }
    })
}