const HaxballJS = require("haxball.js");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");


const x5 = fs.readFileSync(path.join(__dirname, "maps/x5.hbs"), "utf8");
const x4 = fs.readFileSync(path.join(__dirname, "maps/x4.hbs"), "utf8");
const x7 = fs.readFileSync(path.join(__dirname, "maps/x7.hbs"), "utf8");


HaxballJS().then((HBInit) => {
  const room = HBInit({
    roomName: 'Haxball.JS',
    maxPlayers: 16,
    public: true,
    noPlayer: true,
    token: "thr1.AAAAAGkDiEyBcQ2udappgw.9J7auaaGN1Y", // Required
  });

  const CONFIG = {
    webhook: "https://discord.com/api/webhooks/XXXXX",
    discordInvite: "https://discord.gg/CX7vNgkm43",
    maps: { x5: [x5], x4: [x4], x7: [x7] }
  };

  // ===== Roles =====
  const ADMINS = ["Ia_dnTizMTUQyplTIn5_4dxRC1wHsog65o8RmsOvHY0"];
  const VIPS = new Set(["auth5"]);

  // ===== Estado =====
  let USERS = new Set();
  let score = { red: 0, blue: 0 };
  let lastReplay = null;
  let gameInProgress = false;

  // ===== Funciones de utilidad =====
  function getAuth(player) { return player?.auth || ""; }
  function getPlayerByName(name) { return room.getPlayerList().find(p => p.name.toLowerCase() === name.toLowerCase()); }

  function getTagStyle(player) {
    const auth = getAuth(player);
    if (ADMINS.includes(auth)) return { tag: "👑 [ADMIN]", color: 0xFFD700 };
    if (VIPS.has(auth)) return { tag: "⭐ [VIP]", color: 0x00FFFF };
    return { tag: "👤 [USUARIO]", color: 0xAAAAAA };
  }

  function isAdmin(player) { return ADMINS.includes(getAuth(player)); }

  // ===== Chat =====
  room.onPlayerChat = async (player, message) => {
    const msg = message.trim();

    // Comandos
    if (msg.startsWith("!")) return handleCommand(player, msg);

    // Mensaje normal
    const { tag, color } = getTagStyle(player);
    room.sendAnnouncement(`${tag} ${player.name}: ${message}`, null, color, "bold");
  };

  // ===== Comandos =====
  async function handleCommand(player, msg) {
    const words = msg.trim().split(/\s+/);
    const cmd = words[0].toLowerCase();

    // Kick voluntario
    if (cmd === "!nv" || cmd === "!bb") {
      room.sendAnnouncement(`👋 ${player.name} salió de la sala.`, null, 0xAAAAAA, "italic");
      room.kickPlayer(player.id, "Salida voluntaria", true);
      return true;
    }

    // Admin
    if (cmd === "!adminpotrero") {
      const auth = getAuth(player);
      if (!ADMINS.includes(auth)) {
        ADMINS.push(auth);
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(`🔱 ${player.name} ahora es Admin.`, null, 0xFFD700, "bold");
      } else {
        room.sendAnnouncement(`⚠️ ${player.name} ya es admin.`, player.id, 0xAAAAAA);
      }
      return true;
    }

    // Añadir VIP
    if (cmd === "!añadirvip") {
      if (!isAdmin(player)) {
        room.sendAnnouncement("⛔ No tenés permiso para usar este comando.", player.id, 0xFF0000);
        return true;
      }
      const targetName = words.slice(1).join(" ");
      const target = getPlayerByName(targetName);
      if (!target) {
        room.sendAnnouncement(`❌ No se encontró al jugador "${targetName}".`, player.id, 0xFF0000);
        return true;
      }
      VIPS.add(getAuth(target));
      room.sendAnnouncement(`💎 ${target.name} ahora es VIP.`, null, 0x00FFFF, "bold");
      return true;
    }

    // Mapas
    if (["!x5","!x4","!x7"].includes(cmd)) {
      const mapKey = cmd.substring(1);
      const maps = CONFIG.maps[mapKey];
      if (maps && maps.length > 0) {
        room.setCustomStadium(maps[0]);
        room.sendAnnouncement(`🗺️ Mapa cambiado a ${mapKey}`, null, 0xAAAAAA, "bold");
      }
      return true;
    }

    return false;
  }

  // ===== Replays =====
  room.onGameStart = () => { gameInProgress = true; score = { red:0, blue:0 }; room.startRecording(); };
  room.onTeamGoal = (team) => { if(team===1) score.red++; else if(team===2) score.blue++; };
  room.onGameStop = async () => { if(gameInProgress){ gameInProgress=false; await handleReplayUpload(); } };
  room.onGameEnd = async () => { if(gameInProgress){ gameInProgress=false; await handleReplayUpload(); } };

  async function handleReplayUpload() {
    try {
      const replayFile = room.stopRecording();
      lastReplay = replayFile;

      const embed = {
        username: "Replay Bot",
        embeds: [{
          title: "🏁 Match Finished",
          description: `🔴 ${score.red} - ${score.blue} 🔵`,
          color: score.red>score.blue?0xff4d4d:score.blue>score.red?0x4d79ff:0xcccccc,
          timestamp: new Date().toISOString()
        }]
      };

      await fetch(CONFIG.webhook, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(embed) });
    } catch(e) { console.error("Replay upload failed:", e); }
  }

  // ===== Eventos =====
  room.onPlayerJoin = (player) => {
    USERS.add(getAuth(player));
    room.sendAnnouncement(`👋 Bienvenido ${player.name} | 🔗 Discord: ${CONFIG.discordInvite}`, player.id, 0xFFD700, "bold");
  };

  // ===== Mensaje automático Discord cada 5 minutos =====
  setInterval(() => {
    room.sendAnnouncement(`🔗 Únete a nuestro Discord: ${CONFIG.discordInvite}`, null, 0x00FFFF, "bold");
  }, 5*60*1000);

  console.log("[Potrero] Script cargado. Listo para usar.");
});
