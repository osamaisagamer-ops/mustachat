import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
// Use path.resolve for a robust path to the public directory
const __dirname = path.dirname(__filename);

const app = express();
// Serve static files from the 'public' directory (where index.html, style.css, script.js live)
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

console.log("Chat server running");

// ===== ADMIN SETTINGS =====
const ADMIN_NICK = "nimda"; 
let chatFrozen = false;
let banned = new Set();

// ===== SERVER STATE =====
// Store clients in a Map: ws -> { id, nick }
let clients = new Map();

// ===== UTILITIES =====
// Broadcast a message object to all connected clients
function broadcast(msgObj, except = null) {
    const msg = JSON.stringify(msgObj);
    wss.clients.forEach(client => {
        // Ensure the client is open before sending
        if (client.readyState === 1 && client !== except) {
            client.send(msg);
        }
    });
}

// Send the current list of users to all clients
function broadcastUserList() {
    const userList = [...clients.values()].map(u => u.nick);
    broadcast({ type: "users", users: userList });
}

// ===== CONNECTION HANDLER =====
wss.on("connection", ws => {
    // Generate a unique ID for the new connection
    const id = Math.random().toString(36).slice(2, 10);
    clients.set(ws, { id, nick: "anon" });

    ws.send(JSON.stringify({ type: "system", text: `Welcome! Your id is: ${id}` }));
    broadcastUserList();

    ws.on("message", raw => {
        let msg;
        try { 
            // Attempt to parse the incoming message JSON
            msg = JSON.parse(raw); 
        } catch { 
            // Ignore if not valid JSON
            return; 
        }

        const user = clients.get(ws);
        // Check if user is known and not banned
        if (!user || banned.has(user.id)) return ws.close();

        let text = msg.text;

        // Update nickname if provided in the message
        if(msg.nick) user.nick = msg.nick;
        
        // This command was for the old reverse spelling, changed to /freeze
        if(text.startsWith("\\opsit")) text = "/freeze"; 

        // ===== ADMIN COMMANDS ONLY (nimda) =====
        if(user.nick === ADMIN_NICK && text.startsWith("/")){
            const parts = text.trim().split(" ");
            const cmd = parts[0];

            switch(cmd){
                case "/kick": { // FIXED from /kcik
                    const target = [...clients.entries()].find(([w,u]) => u.id===parts[1]);
                    if(target) target[0].close();
                    broadcast({ type:"system", text:`Client ${parts[1]} was kicked by ADMIN`});
                    break;
                }

                case "/ban": { // FIXED from /nab
                    const target = [...clients.entries()].find(([w,u]) => u.id===parts[1]);
                    if(target){
                        banned.add(parts[1]);
                        target[0].close();
                        // Special message for the client to catch the ban status
                        broadcast({ type:"system", admin: true, text:`Client ${parts[1]} was banned for 30 minutes by ADMIN`});
                    }
                    break;
                }

                case "/rename": { // FIXED from /kcin
                    const target = [...clients.entries()].find(([w,u]) => u.id===parts[1]);
                    if(target){
                        target[1].nick = parts[2] || target[1].nick;
                        broadcast({ type:"system", text:`Client ${parts[1]} is now ${parts[2]}`});
                        broadcastUserList(); // Update list after renaming
                    }
                    break;
                }

                case "/freeze": { // FIXED from /opsit
                    chatFrozen = !chatFrozen;
                    broadcast({ type:"system", text: chatFrozen ? "⚠️ Chat is frozen! No talking allowed." : "✅ Chat unfrozen! Talk freely." });
                    break;
                }

                case "/warn": { // Original /w
                    const target = [...clients.entries()].find(([w,u]) => u.id===parts[1]);
                    if(target){
                        const warnMsg = parts.slice(2).join(" ");
                        target[0].send(JSON.stringify({ type:"system", text:`⚠️ WARNING: ${warnMsg}`}));
                        broadcast({ type:"system", text:`${target[1].nick} was warned by ADMIN`});
                    }
                    break;
                }

                case "/highlight": { // Original /h
                    const highlightMsg = parts.slice(1).join(" ");
                    broadcast({ type:"highlight", text: highlightMsg });
                    break;
                }
            }
            return;
        }

        // ===== NORMAL CHAT =====
        if(msg.type==="chat"){
            if(chatFrozen) return;
            const displayNick = (user.nick === ADMIN_NICK) ? "ADMIN" : user.nick;
            // Broadcast the chat message
            broadcast({ type:"chat", id: user.id, nick: displayNick, text: msg.text });
        }
        
        // This is necessary to ensure nick changes update the list
        broadcastUserList();
    });

    ws.on("close", () => {
        clients.delete(ws);
        broadcastUserList();
    });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));