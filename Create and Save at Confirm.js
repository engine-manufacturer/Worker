import axios from "axios";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import notifier from "node-notifier";

 

  
const apiToken = '7bef83fe-067d-4db8-85d9-09a968a14bba';

// Get a fresh NSTBrowser session for each account
async function getFreshWsUrl() {
  const config = encodeURIComponent(JSON.stringify({
    once: true,
    headless: false,
    autoClose: true,
	proxy: 'http://nozomi.proxy.rlwy.net:47246',
    fingerprint: {
      flags: {
        canvas: "Noise",
        webgl: "Noise",
        audio: "Noise",
        fonts: "Masked",
        battery: "Masked",
        speech: "Masked",
        webrtc: "Custom",
      }
    }
  }));

  const res = await fetch(`http://localhost:8848/api/v2/connect?config=${config}`, {
    headers: { 'x-api-key': apiToken }
  });
  const data = await res.json();
  const profileId = data.data.profileId;
  const wsUrl = `ws://127.0.0.1:8848/devtool/launch/${profileId}?x-api-key=${apiToken}`;
  console.log('🆕 Fresh fingerprint profile:', profileId);
  return wsUrl;
}


 

 
const registration_names = fs
  .readFileSync("registration_names.txt", "utf8")
  .split("\n")
  .map(line => line.trim())
  .filter(Boolean); // remove empty lines
 
 
  
  
let firstname, lastname;

function getRandomName(){
const randomName = registration_names[Math.floor(Math.random() * registration_names.length)];

([firstname, lastname] = randomName.split(" "));
}


function randomBirth(type) {
    switch(type.toLowerCase()) {
        case 'day':
            return (Math.floor(Math.random() * 28) + 1).toString(); // "1" to "28"
        case 'month':
            return (Math.floor(Math.random() * 12) + 1).toString(); // "1" to "12"
        case 'year':
            return (Math.floor(Math.random() * (2002 - 1980 + 1)) + 1980).toString(); // "1980" to "2002"
        default:
            return 'Invalid type! Use "day", "month", or "year".';
    }
}




puppeteer.use(Stealth());

function randomString(len = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return [...Array(len)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function saveAccountDetails(email, password) {
    const folder = path.join(process.cwd(), "newAccountsLists");
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const filepath = path.join(folder, "accounts.txt");
    fs.appendFileSync(filepath, `\n ${email} | ${password} | ${firstname} ${lastname} \n`);
}


async function saveCookies(page) {
    const folder = path.join(process.cwd(), "confirmEmailSessions");
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const filename = randomString() + ".json";
    const filepath = path.join(folder, filename);

    const cookies = await page.cookies();
    fs.writeFileSync(filepath, JSON.stringify(cookies, null, 2));

    console.log("Cookies saved:", filepath);
}

async function waitForRealEmail(page) {
    return await page.waitForFunction(() => {
        const el = document.querySelector('#mail_address');
        if (!el) return false;
        const v = el.value.trim().toLowerCase();
       // MUST be > 0 characters
        if (v.length === 0) return false;
       // MUST NOT contain "loading"
        if (v.includes("loading")) return false;
       // Good value: return original (not lowercased)
        return el.value.trim();
    });
}


async function humanLikeMouseMove(page, x1, y1, x2, y2) {
    await page.mouse.move(x1, y1, { steps: 5 + Math.floor(Math.random() * 10) });
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    await page.mouse.move(x2, y2, { steps: 5 + Math.floor(Math.random() * 10) });
}

async function clickElementHumanLike(page, elHandle) {
    const box = await elHandle.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await humanLikeMouseMove(page, box.x, box.y, cx, cy);
    await page.mouse.down();
    await page.mouse.up();
}

function generateRandomEmail() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const name = [...Array(10)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${name}@gmail.com`;
}


  async function tapElement(page, elHandle) {
    // evaluateHandle returns JSHandle — .asElement() converts to ElementHandle
    const el = (elHandle.asElement && elHandle.asElement()) || elHandle;
    if (!el) throw new Error("tapElement: could not resolve to ElementHandle");

    // Always scroll into view — on mobile many elements sit below the fold
    // and tapping off-screen coordinates silently does nothing
    await page.evaluate(e => e.scrollIntoView({ behavior: 'instant', block: 'center' }), el);
    await new Promise(r => setTimeout(r, 300));

    const box = await el.boundingBox();
    if (!box) throw new Error("tapElement: element has no bounding box (hidden or detached)");

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Small random jitter so taps are not pixel-perfect
    const jx = cx + (Math.random() * 4 - 2);
    const jy = cy + (Math.random() * 4 - 2);

    await page.touchscreen.tap(jx, jy);
    await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
  }
  
  async function humanClick(page, selector) {
  const el = await page.waitForSelector(selector, { visible: true });
  const box = await el.boundingBox();
  
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move from a random starting point to the element with natural steps
  const startX = cx + (Math.random() * 200 - 100);
  const startY = cy + (Math.random() * 200 - 100);

  await page.mouse.move(startX, startY);
  await page.mouse.move(cx, cy, { steps: 10 + Math.floor(Math.random() * 20) });
  await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
  await page.mouse.click(cx, cy);
}


async function createHiddenPage(browser) {  
  const pages = await browser.pages();
  const page = pages[0];
  
  const session = await page.createCDPSession();
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: { left: -3000, top: -3000, width: 1280, height: 800 }
  });

  return page;
}

async function checkFacebookError(page) {
    try {
        const message = await page.evaluate(() => {
            const el = document.getElementById('reg_error_inner');
            if (!el) return null;

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const isVisible =
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0;

            if (!isVisible) return null;

            return el.textContent.trim();
        });

        if (message) {
             return true; // error exists
        }

        return false; // no error
    } catch (err) {
         return false; // treat failures as "no error"
    }
}



let accountCounter = 0;
 const wsUrl = await getFreshWsUrl();
  const browser = await puppeteer.connect({ 
    browserWSEndpoint: wsUrl,
    defaultViewport: null
  });

// ------------------------------------------------------------
//  MAIN ACCOUNT CREATION PROCESS WRAPPED IN A FUNCTION
// ------------------------------------------------------------
async function createAccount() {
    console.log("\n-----------------------------");
    console.log("🔁 Starting new loop iteration");
    console.log("-----------------------------\n");

    const platform = await browser.createBrowserContext();

     try {

    const facebookPage = await platform.newPage();
	
	
	/****** move off screen ****/
	
  
	
	
	
	/***** end: move off screen ***/

      // ── MOBILE EMULATION ──────────────────────────────────────

      await facebookPage.setUserAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      );

      await facebookPage.setViewport({
        width: 393,
        height: 851,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3
      });
      // FIXED: removed the second setViewport({ width:1600, height:900 })
      // that was overwriting the mobile viewport back to desktop

      // ── ANTI-DETECTION ────────────────────────────────────────
      await facebookPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Intl.DateTimeFormat.prototype.resolvedOptions = function () {
          return { timeZone: 'America/New_York' };
        };
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) return 'Qualcomm';          // realistic for Galaxy
          if (parameter === 37446) return 'Adreno (TM) 740';  // realistic for S23
          return getParameter(parameter);
        };
      });
	  
	 

      await facebookPage.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      // ── NAVIGATE ──────────────────────────────────────────────
      // FIXED: using m.facebook.com — with Galaxy UA, facebook.com sometimes
      // still serves the desktop layout on first load
      await facebookPage.goto("https://m.facebook.com", { waitUntil: "networkidle2", timeout: 30000 });

      // ── DECLINE COOKIES ───────────────────────────────────────
      // Cookie wall may or may not appear depending on region.
      // We wait up to 5s for it — if it never shows, we move on.
      try {
        await facebookPage.waitForFunction(() => {
          return [...document.querySelectorAll("div, button, span, a, p")]
            .some(el => el.textContent.trim().toLowerCase() === "decline optional cookies");
        }, { timeout: 5000 });

        const declineCookies = await facebookPage.evaluateHandle(() => {
          return [...document.querySelectorAll("div, button, span, a, p")]
            .find(el => el.textContent.trim().toLowerCase() === "decline optional cookies") || null;
        });
        await tapElement(facebookPage, declineCookies);
        console.log("🍪 Declined cookies");
      } catch (err) {
        console.log("🍪 No cookie prompt — skipping");
      }
	  
	  	    await new Promise(r => setTimeout(r, 2000));


      // ── WAIT FOR LOGIN PAGE ────────────────────────────────────
      // After declining (or if no cookie wall), wait for the login page
      // to fully render before looking for "Create new account".
      // On mobile the button text is exactly "Create new account" and sits
      // below the Log In button as a standalone link/button.
 

      // ── TEMP MAIL ─────────────────────────────────────────────
      const tempMailPage = await platform.newPage();
	  
 
      await tempMailPage.goto("https://10minutemail.com", { waitUntil: "domcontentloaded", timeout: 90000 });
      await tempMailPage.waitForSelector('#mail_address', { visible: true });
      await waitForRealEmail(tempMailPage);
      console.log("email ready");
      const email = await tempMailPage.evaluate(() => document.querySelector('#mail_address').value);
      console.log("TEMP MAIL:", email);

      // ── CREATE ACCOUNT BUTTON ─────────────────────────────────
      await facebookPage.bringToFront();
	  
	  	    await new Promise(r => setTimeout(r, 2000));
			
 


//await facebookPage.click('[aria-label="Create new account"]');
await humanClick(facebookPage, '[aria-label="Create new account"]');
	  
	
	  
	    await new Promise(r => setTimeout(r, 5000));
		
	 
  
	//await facebookPage.click('[aria-label="Create new account"]');
	await humanClick(facebookPage, '[aria-label="Create new account"]');

 	  
	  
	  	    await new Promise(r => setTimeout(r, 5000));



	 
	  
     

      // Confirm the registration form fields are present
      await facebookPage.waitForFunction(() => {
        return document.querySelectorAll('input').length >= 2;
      }, { timeout: 15000 });

      console.log("📋 Registration form loaded");
	  
 

      // ── DECLINE COOKIES (may re-appear after modal opens) ─────
      try {
        const declineCookies = await facebookPage.evaluateHandle(() => {
          return [...document.querySelectorAll("div, button, span, a, p")]
            .find(el => el.textContent.trim().toLowerCase() === "decline optional cookies") || null;
        });
        await tapElement(facebookPage, declineCookies);
      } catch (err) { }

      // ── MONITOR MOBILE ERROR MESSAGES ─────────────────────────
      // FIXED: #reg_error_inner is a desktop-only element ID.
      // Mobile FB shows errors in role="alert" or data-sigil="m-form-error".
      async function monitorError() {
        const CHECK_INTERVAL_MS = 500;
        while (true) {
          try {
            const message = await facebookPage.evaluate(() => {
              const selectors = [
                '[role="alert"]',
                '[data-sigil="m-form-error"]',
                '.mvm.uiP.fsm',
              ];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) return el.textContent.trim();
              }
              return null;
            });
            if (message) {
              console.log('Facebook Error:', message);
              await browser.close(); // close just this context, not the whole browser
              return;
            }
          } catch (err) { /* page may have navigated */ }
          await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
        }
      }
      monitorError();

      // ── FILL NAME FIELDS ──────────────────────────────────────
      // FIXED: named selectors instead of positional $$('input')[n]
      // Mobile form field order can vary — name attributes are stable.
  
 
	  	    await new Promise(r => setTimeout(r, 5000));

 
 	  await facebookPage.type('input[aria-label="First name"]', firstname, { delay: 80 });

	  await facebookPage.type('input[aria-label="Last name"]', lastname, { delay: 80 });
	  
	  
	    await new Promise(r => setTimeout(r, 1000));
		
		const Next1 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	//  await tapElement(facebookPage, Next1);
	
		await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  	  	    await new Promise(r => setTimeout(r, 1000));

	  await facebookPage.waitForSelector('input[aria-label^="Birthday"]', { visible: true });
	  
	  await facebookPage.evaluate(() => {
  const input = document.querySelector('input[aria-label^="Birthday"]');
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeInputValueSetter.call(input, '1993-03-04');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});


await new Promise(r => setTimeout(r, 1000));
		
		const Next2 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	//  await tapElement(facebookPage, Next2);
			await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  await facebookPage.waitForSelector('[aria-label="Female"]');
	  
		//await tapElement(facebookPage, await facebookPage.$('[aria-label="Female"]'));
		
					await humanClick(facebookPage, '[aria-label="Female"]');

		
		
			const Next3 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	 // await tapElement(facebookPage, Next3);
	 		await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  await facebookPage.waitForSelector('[aria-label="Sign up with email"]');
	  
	  
	  const signUpWithEmail = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "sign up with email") || null;
        });

      
	 // await tapElement(facebookPage, signUpWithEmail);
	 		await humanClick(facebookPage, '[aria-label="Sign up with email"]');

	  
	  
	  await facebookPage.waitForSelector('[aria-label="Email"]');
	  
	  await facebookPage.type('input[aria-label="Email"]', generateRandomEmail(), { delay: 80 });

	  	const Next4 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	 // await tapElement(facebookPage, Next4);
	 	 		await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  await facebookPage.waitForSelector('[aria-label="Password"]');
	  
	  await facebookPage.type('input[aria-label="Password"]', "12@#ENgineer", { delay: 80 });
	  
	  	const Next5 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	//  await tapElement(facebookPage, Next5);
		 		await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  
	  await facebookPage.waitForSelector('[aria-label="Not now"]');
	  

	  
	    const notNow = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "not now") || null;
        });

      
	  //await tapElement(facebookPage, notNow);
	  
	  		 		await humanClick(facebookPage, '[aria-label="Not now"]');

	  
	    await facebookPage.waitForSelector('[aria-label="I agree"]');
	  
	    const iAgree = await facebookPage.$('[aria-label="I agree"]');
		
 		
			//  await tapElement(facebookPage, iAgree);
			
					 		await humanClick(facebookPage, '[aria-label="I agree"]');

			  
			  
		 await facebookPage.waitForSelector('[aria-label="I didn’t get the code"]');
		 
		 
		 
		   const url = facebookPage.url();
          if (url.toLowerCase().includes('confirm')) {
			   accountCounter++;
			console.log("📋 Account Trials: "+accountCounter);
              const cookieFile = await saveCookies(facebookPage);
          }
		 
		 
		 
/*	  
	    const didntGetCode = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "i didn’t get the code") || null;
        });
		
			 // await tapElement(facebookPage, didntGetCode);
			 
			 		 		await humanClick(facebookPage, '[aria-label="I didn’t get the code"]');

			  
			  
			  
			 await facebookPage.waitForSelector('[aria-label="Change email"]');
	  
	    const changeEmail = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "change email") || null;
        });
		
			//  await tapElement(facebookPage, changeEmail);
			
		 			 		 		await humanClick(facebookPage, '[aria-label="Change email"]');

			  
			 
			 
		 await facebookPage.waitForSelector('[aria-label="Email"]');

		await facebookPage.type('input[aria-label="Email"]', email, { delay: 80 });
		
		const Next6 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	 // await tapElement(facebookPage, Next6);
	 	await humanClick(facebookPage, '[aria-label="Next"]');

	  
	  await facebookPage.waitForSelector('[aria-label="Confirmation code"]');


      // ── WAIT FOR CONFIRMATION CODE ────────────────────────────
      await tempMailPage.bringToFront();

      const codeHandle = await tempMailPage.waitForFunction(() => {
        const regex = /\b(\d{5,6})\b/;
        for (const el of document.querySelectorAll("div, span, p, b, i")) {
          const match = el.textContent.match(regex);
          if (match) return match[1];
        }
        return false;
      }, { timeout: 30000 });

      const confirmationCode = await codeHandle.jsonValue();
      console.log("Confirmation Code: " + confirmationCode);

      // ── ENTER CODE ────────────────────────────────────────────
      await facebookPage.bringToFront();
	  
	  await new Promise(r => setTimeout(r, 2000));

	  await facebookPage.type('input[aria-label="Confirmation code"]', confirmationCode, { delay: 80 });

      const Next7 = await facebookPage.evaluateHandle(() => {
            return [...document.querySelectorAll("a, div, button, span")]
                .find(el => el.textContent.trim().toLowerCase() === "next") || null;
        });

      
	 // await tapElement(facebookPage, Next7); 
	 	await humanClick(facebookPage, '[aria-label="Next"]');
		
	await new Promise(r => setTimeout(r, 20000));
	


	
	   
      // ── CHECK IF BLOCKED ──────────────────────────────────────
      await tempMailPage.bringToFront();
      const foundBlocked = await tempMailPage.waitForFunction(() => {
        const target = "action needed on your facebook account";
        for (const el of document.querySelectorAll("span, p, button, a")) {
          if ((el.textContent || "").trim().toLowerCase().includes(target)) return true;
        }
        return false;
      }, { timeout: 60000 })
        .then(() => true)
        .catch(() => false);




      if (foundBlocked) {
        accountCounter = accountCounter + 1;
        console.log("❎ Account NOT saved");
        console.log("📋 Account Trials: " + accountCounter);
	
      } else {
		  
	await facebookPage.goto("https://m.facebook.com", { waitUntil: "networkidle2", timeout: 30000 });
	const currentURL = facebookPage.url();
	const foundBlocked2 = currentURL.includes('checkpoint') || currentURL.includes('confirm');
			  if(foundBlocked2){
					
				        console.log("❎ Second confirmation FAILED");

			  }else{
				  	accountCounter++;
				console.log("✅ Account Saved");
				await saveCookies(facebookPage);
				console.log("📋 Account Trials: " + accountCounter);
					await saveAccountDetails(email, '12@#ENgineer');
						notifier.notify({
				  title: "New Message",
				  message: "You have a new saved account",
				  sound: true,
				  wait: false
				});
				  
			  }
		}
		*/
    }

    catch (err) {
        console.log("❌ ERROR in loop iteration:", err.message);
    }

    finally {
    await platform.close();
    }
}


// ------------------------------------------------------------
//  INFINITE LOOP — RUNS FOREVER UNTIL YOU STOP THE SCRIPT
// ------------------------------------------------------------
 


async function worker(id) {
  while (true) {
    console.log(`🚀 Worker ${id} starting...`);
 		getRandomName();
		try{
        await createAccount();
		}catch(err){};
    console.log(`🔁 Worker ${id} finished`);

    await new Promise(r => setTimeout(r, 5000));
  }
}

const WORKERS = 5;

(async () => {
  await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => worker(i + 1))
  );
})();