// server.js
const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { URL } = require("url");

function absolutize(html, baseUrl) {
    const $ = cheerio.load(html);

    $("a[href], img[src], script[src], link[href]").each((i, el) => {
        const attr = el.name === "img" || el.name === "script" ? "src" : "href";
        const value = $(el).attr(attr);

        if (value && !value.startsWith("http") && !value.startsWith("//")) {
            $(el).attr(attr, new URL(value, baseUrl).href);
        }
    });

    return $.html();
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            let totalHeight = 0;
            const distance = 500;

            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
}

const app = express();

app.get("/render", async (req, res) => {
    const url = req.query.url;

    const browser = await puppeteer.launch(
        {
            args: [
				'--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--mute-audio',
        '--single-process',
        '--disable-extensions',
				   ]
        }
    );
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
	
	await page.evaluate(() => {
		// <img loading="lazy">
		document.querySelectorAll('img[loading="lazy"]').forEach(img => {
			img.loading = "eager";
		});

		// data-src → src
		document.querySelectorAll("img[data-src]").forEach(img => {
			img.src = img.getAttribute("data-src");
		});

		// data-srcset → srcset
		document.querySelectorAll("img[data-srcset]").forEach(img => {
			img.srcset = img.getAttribute("data-srcset");
		});

		// Iframe lazy load
		document.querySelectorAll("iframe[data-src]").forEach(iframe => {
			iframe.src = iframe.getAttribute("data-src");
		});
	});


	await autoScroll(page);
	await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter(img => !img.complete);
    await Promise.all(imgs.map(img => new Promise(res => {
				img.onload = img.onerror = res;
			})));
		});



    let html = await page.content();
    await browser.close();

    html = absolutize(html, url);

    res.send(html);
});

app.listen(80, () => console.log("Renderer działa na porcie 80"));






