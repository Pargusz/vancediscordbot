const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, push, get, child } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyB0kx3UdO2s_aN2pYG6Q_qAgZmXH9Kw73o",
  authDomain: "discordyonetim-a4004.firebaseapp.com",
  databaseURL: "https://discordyonetim-a4004-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "discordyonetim-a4004",
  storageBucket: "discordyonetim-a4004.firebasestorage.app",
  messagingSenderId: "234175418068",
  appId: "1:234175418068:web:93636dc6ec4bf29732f541",
  measurementId: "G-N1ZG6XJ78F"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper functions for Database

async function saveTicketLog(ticketData) {
    const ticketsRef = ref(db, 'tickets');
    const newTicketRef = push(ticketsRef);
    await set(newTicketRef, ticketData);
    return newTicketRef.key;
}

async function updateAdminStats(adminId, adminUsername, rating) {
    const dbRef = ref(db);
    const adminRef = child(dbRef, `admins/${adminId}`);
    
    const snapshot = await get(adminRef);
    let data = {
        username: adminUsername,
        tickets_handled: 0,
        total_rating: 0
    };

    if (snapshot.exists()) {
        data = snapshot.val();
    }

    data.tickets_handled += 1;
    data.total_rating += parseInt(rating);
    
    // Calculate average on the fly or just store total and count
    await set(ref(db, `admins/${adminId}`), data);
}

async function getAdminLeaderboard() {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'admins'));
    if (snapshot.exists()) {
        const admins = snapshot.val();
        let leaderboard = [];
        for (const [id, data] of Object.entries(admins)) {
            const avgRating = data.tickets_handled > 0 ? (data.total_rating / data.tickets_handled).toFixed(1) : 0;
            leaderboard.push({
                id,
                username: data.username,
                tickets_handled: data.tickets_handled,
                avg_rating: avgRating
            });
        }
        // Sort by tickets handled (descending)
        return leaderboard.sort((a, b) => b.tickets_handled - a.tickets_handled);
    }
    return [];
}

async function getAllTickets() {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'tickets'));
    if (snapshot.exists()) {
        const tickets = snapshot.val();
        const ticketList = [];
        for (const [key, val] of Object.entries(tickets)) {
            ticketList.push({ id: key, ...val });
        }
        return ticketList.reverse(); // newest first
    }
    return [];
}

async function saveApplication(appData) {
    const appsRef = ref(db, 'applications');
    const newAppRef = push(appsRef);
    await set(newAppRef, { ...appData, status: 'pending', createdAt: new Date().toISOString() });
    return newAppRef.key;
}

async function getAllPendingApplications() {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'applications'));
    if (snapshot.exists()) {
        const apps = snapshot.val();
        const appList = [];
        for (const [key, val] of Object.entries(apps)) {
            if (val.status === 'pending') {
                appList.push({ id: key, ...val });
            }
        }
        return appList.reverse(); // newest first
    }
    return [];
}

async function updateApplicationStatus(appId, status) {
    const appRef = ref(db, `applications/${appId}`);
    const snapshot = await get(appRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        data.status = status; // 'approved' or 'rejected'
        await set(appRef, data);
        return data;
    }
    return null;
}

async function saveDirectMessage(userId, userTag, avatar, content, direction, attachments = []) {
    const messagesRef = ref(db, `dms/${userId}/messages`);
    const newMsgRef = push(messagesRef);
    const timestamp = new Date().toISOString();
    await set(newMsgRef, {
        content,
        direction,
        attachments,
        timestamp
    });

    const metaRef = ref(db, `dms/${userId}/meta`);
    await set(metaRef, {
        userTag,
        avatar,
        lastMessageAt: timestamp,
        lastMessage: content.substring(0, 50)
    });
}

async function getDirectMessages() {
    const dmsRef = ref(db, 'dms');
    const snapshot = await get(dmsRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        const dmList = [];
        for (const [userId, dmData] of Object.entries(data)) {
            if (dmData.meta) {
                const messages = [];
                if (dmData.messages) {
                    for (const [msgId, msgData] of Object.entries(dmData.messages)) {
                        messages.push({ id: msgId, ...msgData });
                    }
                }
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                dmList.push({ userId, meta: dmData.meta, messages });
            }
        }
        return dmList.sort((a, b) => new Date(b.meta.lastMessageAt) - new Date(a.meta.lastMessageAt));
    }
    return [];
}

module.exports = {
    saveTicketLog,
    updateAdminStats,
    getAdminLeaderboard,
    getAllTickets,
    saveApplication,
    getAllPendingApplications,
    updateApplicationStatus,
    saveDirectMessage,
    getDirectMessages
};
