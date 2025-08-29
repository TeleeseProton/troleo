const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOMS = process.env.HAXBALL_ROOMS.split(',');
const JOB_INDEX = parseInt(process.env.JOB_INDEX || 0);
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const MENSAJE = process.env.MENSAJE || "Hola!";
const LLAMAR_ADMIN = process.env.LLAMAR_ADMIN || "";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm";

function getRoomForJob() {
    if (!HAXBALL_ROOMS.length) return '';
    return HAXBALL_ROOMS[JOB_INDEX % HAXBALL_ROOMS.length].trim();
}

async function notifyDiscord(message) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
    } catch (e) {
        console.error("Error al enviar notificación a Discord:", e);
    }
}

async function sendMessageToChat(frame, message) {
    if (!message) return;
    try {
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        const chatInput = await frame.$(chatSelector);
        if (!chatInput) return;
        await chatInput.click({ delay: 50 });
        await chatInput.type(message, { delay: 50 });
        await chatInput.press('Enter');
    } catch (e) {
        console.warn("No se pudo enviar mensaje al chat:", e.message);
    }
}

async function main() {
    const HAXBALL_ROOM_URL = getRoomForJob();
    console.log(`🤖 Bot ${BOT_NICKNAME} entrando a: ${HAXBALL_ROOM_URL}`);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const countryCodes = ["uy","ar","br","cn","ly","me","vi","cl","cy"];
    const code = countryCodes[Math.floor(Math.random() * countryCodes.length)];
    await page.evaluateOnNewDocument((code) => {
        localStorage.setItem("geo", JSON.stringify({ lat: -34.65, lon: -58.38, code }));
    }, code);

    await page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('iframe');
    const frame = await (await page.$('iframe')).contentFrame();

    // Poner nombre y dar Enter
    const nickSelector = 'input[data-hook="input"][maxlength="25"]';
    await frame.waitForSelector(nickSelector);
    await frame.type(nickSelector, BOT_NICKNAME);
    await frame.keyboard.press('Enter');

    await page.waitForTimeout(2000); // espera para spamear

    // Spam inicial y anti-AFK
    sendMessageToChat(frame, LLAMAR_ADMIN);

    // Spam repetido cada 5 segundos
    setInterval(() => sendMessageToChat(frame, MENSAJE), 5000);
    setInterval(() => sendMessageToChat(frame, LLAMAR_ADMIN), 600000);

    // Anti-AFK
    const keys = ['w','a','s','d'];
    let index = 0;
    setInterval(() => {
        page.keyboard.press(keys[index % keys.length]);
        index++;
    }, 5000);

    console.log("✅ Bot iniciado: spameando y anti-AFK activo.");
    await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);
}

// Ejecutar con reintentos simples
let intentos = 0;
const MAX_INTENTOS = 1000;
async function iniciarBotConReintentos() {
    while (intentos < MAX_INTENTOS) {
        try {
            intentos++;
            console.log(`🔁 Intento ${intentos} de ${MAX_INTENTOS}`);
            await main();
            break;
        } catch (e) {
            console.error(`❌ Intento ${intentos} fallido:`, e.message);
            await notifyDiscord(`🔴 Fallo en intento ${intentos} para el bot **${BOT_NICKNAME}**. Error: ${e.message}`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

iniciarBotConReintentos();
