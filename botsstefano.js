const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOMS = process.env.HAXBALL_ROOMS.split(',');
const JOB_INDEX = parseInt(process.env.JOB_INDEX || 0);
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm";
// ----------------------

// Selecciona la sala
function getRoomForJob() {
    if (!HAXBALL_ROOMS.length) return '';
    return HAXBALL_ROOMS[JOB_INDEX % HAXBALL_ROOMS.length].trim();
}

// Función para manejar errores críticos
function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);
    process.exit(1);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => handleCriticalError(error, 'Excepción no capturada'));
process.on('unhandledRejection', (reason) => handleCriticalError(new Error(reason), 'Promesa rechazada'));

async function main() {
    const HAXBALL_ROOM_URL = getRoomForJob();
    console.log(`🤖 Bot ${BOT_NICKNAME} entrando a: ${HAXBALL_ROOM_URL}`);

    let browser, page;

    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        page = await browser.newPage();

        // Simular geolocalización
        const haxballCountryCodes = ["uy","ar","br","cn","ly","me","vi","cl","cy"];
        const randomCode = haxballCountryCodes[Math.floor(Math.random() * haxballCountryCodes.length)];
        await page.evaluateOnNewDocument((code) => {
            localStorage.setItem("geo", JSON.stringify({ lat: -34.6504, lon: -58.3878, code: code || 'ar' }));
        }, randomCode);

        await page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();
        if (!frame) throw new Error('No se pudo acceder al iframe de Haxball');

        // Escribir nickname y presionar Enter
        const nickSelector = 'input[data-hook="input"][maxlength="25"]';
        await frame.waitForSelector(nickSelector, { timeout: 15000 });
        const nickInput = await frame.$(nickSelector);
        await nickInput.click();
        await nickInput.type(BOT_NICKNAME);
        await nickInput.press('Enter');

        // Captcha opcional
        try {
            const onlyHumansButton = await frame.waitForSelector('button', { timeout: 5000 });
            await onlyHumansButton.click();
            console.log("✅ Captcha 'Only humans' clickeado automáticamente");
        } catch (e) {
            console.log("ℹ️ No apareció captcha, continuando...");
        }

        // Espera 5 segundos antes de spamear
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Chat listo
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 10000 });
        console.log("✅ Chat listo, empezando spam");
        await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);

        // Mensaje inicial
        await sendMessageToChat(frame, process.env.LLAMAR_ADMIN);

        // Spam periódico
        const chatInterval = setInterval(async () => {
            try {
                await sendMessageToChat(frame, process.env.MENSAJE);
            } catch (error) {
                console.error("Error al enviar mensaje al chat:", error);
                clearInterval(chatInterval);
            }
        }, 5000);

        // Anti-AFK
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        const moveInterval = setInterval(async () => {
            const key = moves[moveIndex % moves.length];
            await page.keyboard.press(key);
            moveIndex++;
        }, 5000);

        // Mantener vivo 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));

        clearInterval(chatInterval);
        clearInterval(moveInterval);

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);
        if (browser) await browser.close();
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await notifyDiscord(`🟡 El bot **${BOT_NICKNAME}** ha terminado su ejecución.`);
    }
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
    const chatSelector = 'input[data-hook="input"][maxlength="140"]';
    await frame.waitForSelector(chatSelector, { timeout: 5000 });
    const chatInput = await frame.$(chatSelector);
    await chatInput.click();
    await chatInput.type(message);
    await chatInput.press('Enter');
    console.log("Mensaje enviado:", message);
}

let intentos = 0;
const MAX_INTENTOS = 1000;

async function iniciarBotConReintentos() {
    while (intentos < MAX_INTENTOS) {
        try {
            intentos++;
            console.log(`🔁 Intento ${intentos} de ${MAX_INTENTOS}`);
            await main();
            break;
        } catch (error) {
            console.error(`❌ Intento ${intentos} fallido:`, error.message);
            await notifyDiscord(`🔴 Fallo en intento ${intentos} para el bot **${BOT_NICKNAME}**. Error: ${error.message}`);
            if (intentos >= MAX_INTENTOS) {
                await notifyDiscord(`❌ El bot **${BOT_NICKNAME}** falló tras ${MAX_INTENTOS} intentos.`);
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

iniciarBotConReintentos();
