const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: 'Phone number required' });
    }

    async function NAPPIER_XMD_PAIR_CODE() {
        if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.macOS('Chrome')
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num, 'NAPPIER1');
                if (!res.headersSent) {
                    await res.json({ status: 'Pairing started', code: code });
                }
            }

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === 'open') {
                    await delay(5000);
                    
                    const rf = __dirname + '/temp/' + id + '/creds.json';
                    const safeId = sock.user.id.replace(/[^0-9a-zA-Z]/g, '_');
                    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    console.log('[pair.js] Connection open! user:', sock.user.id, '→ sending to:', myJid);

                    try {
                        if (!fs.existsSync(rf)) {
                            console.error('[pair.js] creds.json not found at', rf);
                            return;
                        }

                        // ─── Upload to Mega ──────────────────────────────
                        let string_session = null;
                        for (let attempt = 1; attempt <= 3; attempt++) {
                            try {
                                const mega_url = await upload(fs.createReadStream(rf), safeId + '.json');
                                string_session = mega_url.replace('https://mega.nz/file/', '');
                                console.log('[session] Mega upload OK on attempt', attempt);
                                break;
                            } catch (megaErr) {
                                console.error('[session] Mega attempt', attempt, 'failed:', megaErr.message);
                                if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt));
                            }
                        }

                        if (!string_session) {
                            console.error('[pair.js] Mega failed all attempts');
                            await sock.sendMessage(myJid, {
                                text: '❌ Session upload failed. Please try pairing again.',
                            }).catch(() => {});
                            return;
                        }

                        // ─── Send SESSION_ID ──────────────────────────────
                        const sessionId = 'NAPPIER-XMD!' + string_session;
                        await sock.sendMessage(myJid, {
                            text: `✅ *SESSION CONNECTED SUCCESSFULLY!*

🔐 *SESSION_ID:* 
\`${sessionId}\`

📌 Copy this SESSION_ID and add it to your Heroku Config Vars.

🤖 Bot is ready to use!

⚡ Powered by lycifer`
                        });
                        console.log("✅ SESSION_ID sent successfully");

                        // ─── Send promo image ────────────────────────────
                        await sock.sendMessage(myJid, {
                            image: { url: 'https://files.catbox.moe/99ofzd.jpg' },
                            caption: `🔐 Keep your SESSION_ID safe!

📌 Use it in Heroku Config Vars: SESSION_ID

⚡ Powered by lycifer`,
                            contextInfo: {
                                forwardingScore: 999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterName: 'NAPPIER-XMD',
                                    newsletterJid: '120363399905192716@newsletter',
                                },
                            },
                        });
                        console.log("🎬 Promo image sent successfully");

                        await delay(1000);
                        removeFile('./temp/' + id);
                        console.log("✅ Session cleaned up successfully");

                    } catch (error) {
                        console.error("❌ Error sending messages:", error);
                        removeFile('./temp/' + id);
                    }

                    try { sock.ws.close(); } catch (_) {}
                    return await removeFile('./temp/' + id);

                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    NAPPIER_XMD_PAIR_CODE();
                }
            });
        } catch (err) {
            console.log('Service restarted');
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.status(500).json({ error: 'Service Currently Unavailable' });
            }
        }
    }
    
    return await NAPPIER_XMD_PAIR_CODE();
});

module.exports = router;
