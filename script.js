document.addEventListener("DOMContentLoaded", () => {
    // Connect to the WebSocket server running on the same host
    const ws = new WebSocket(`ws://${location.host}`);

    const messagesDiv = document.getElementById("messages");
    const nameInput = document.getElementById("nameInput");
    const msgInput = document.getElementById("msgInput");
    const btn = document.getElementById("sendBtn");
    const suggestionsDiv = document.getElementById("commandSuggestions");
    const usersDiv = document.getElementById("users");

    // Corrected Admin Commands list
    const adminCommands = [
        "/kick [id]",
        "/ban [id]",
        "/rename [id] [name]",
        "/freeze",
        "/warn [id] [message]",
        "/highlight [message]"
    ];

    let myNick = "anon";

    // ============== BAN POPUP (CUSTOM MODAL) ==============
    const banOverlay = document.createElement("div");
    // Styling for a custom, full-screen overlay (instead of alert/confirm)
    banOverlay.style.position = "fixed";
    banOverlay.style.top = "0";
    banOverlay.style.left = "0";
    banOverlay.style.width = "100%";
    banOverlay.style.height = "100%";
    banOverlay.style.background = "rgba(0,0,0,0.8)";
    banOverlay.style.color = "#ff4d4d";
    banOverlay.style.display = "flex";
    banOverlay.style.flexDirection = "column";
    banOverlay.style.justifyContent = "center";
    banOverlay.style.alignItems = "center";
    banOverlay.style.fontSize = "24px";
    banOverlay.style.zIndex = "999";
    banOverlay.style.textAlign = "center";
    banOverlay.style.display = "none";
    document.body.appendChild(banOverlay);

    function showBanOverlay(minutes) {
        banOverlay.textContent = `You have been banned for ${minutes} minutes.`;
        banOverlay.style.display = "flex";
        // Disable inputs when banned to stop the user from typing
        msgInput.disabled = true;
        btn.disabled = true;
        nameInput.disabled = true;
    }

    function hideBanOverlay() {
        banOverlay.style.display = "none";
        // Re-enable inputs after the ban time (or manually after admin undo)
        msgInput.disabled = false;
        btn.disabled = false;
        nameInput.disabled = false;
        msgInput.focus();
    }

    // ============== NICKNAME & SUGGESTIONS ==============
    nameInput.addEventListener("input", () => {
        myNick = nameInput.value.trim() || "anon";

        // Show admin commands if the nickname is 'nimda'
        if (myNick.toLowerCase() === "nimda") {
            suggestionsDiv.style.display = "block";
            suggestionsDiv.innerHTML = adminCommands.map(cmd => `<div>${cmd}</div>`).join("");
        } else {
            suggestionsDiv.style.display = "none";
        }
    });

    // Populate the message input with the clicked suggestion
    suggestionsDiv.addEventListener("click", e => {
        if (e.target.tagName === "DIV") {
            msgInput.value = e.target.textContent;
            msgInput.focus();
        }
    });

    // ============== SEND MESSAGE FUNCTION (FIXED) ==============
    function sendMessage() {
        const text = msgInput.value.trim();
        if (!text || ws.readyState !== WebSocket.OPEN) return;

        // FIX: Always send type: "chat". The server is responsible for checking if the text starts with a command.
        ws.send(JSON.stringify({
            type: "chat", 
            text,
            nick: myNick
        }));

        msgInput.value = "";
        msgInput.focus();
    }

    // Event listeners for the Send button and Enter key
    btn.addEventListener("click", sendMessage);
    msgInput.addEventListener("keydown", e => e.key === "Enter" && sendMessage());

    // ============== RECEIVE MESSAGES (FIXED) ==============
    ws.addEventListener("message", event => {
        const data = JSON.parse(event.data);

        // Update user list separately
        if (data.type === "users") {
            usersDiv.innerHTML = data.users.map(u => `<div>${u}</div>`).join("");
            return;
        }

        // Handle ban status received from the server (using the admin flag and message)
        if (data.admin && data.text && data.text.toLowerCase().includes("banned for 30 minutes")) {
            showBanOverlay(30);
            // Optionally set a timer to auto-unban, though server handles the actual ban list
            // setTimeout(hideBanOverlay, 30 * 60 * 1000); 
        }

        const div = document.createElement("div");

        // Set CSS classes based on message type
        if (data.admin) div.className = "message adminMsg";
        else if (data.type === "system") div.className = "message system";
        else if (data.type === "highlight") div.className = "message highlight";
        else div.className = "message";

        const displayNick = data.nick === "nimda" ? "ADMIN" : data.nick;

        // FIX: Correctly structure the message content to prevent display errors
        if (data.type === "chat" && data.text) {
            // Normal chat message format: [Nick]: Message
            div.textContent = `[${displayNick}]: ${data.text}`;
        } else {
            // System/admin/highlight messages use the text content directly
            div.textContent = data.text; 
        }

        messagesDiv.appendChild(div);
        // Auto-scroll to the bottom of the message list
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
});