const server = require('http').createServer();
const io = require('socket.io')(server);
const addTaskToDelayQueue = require('./DelayQueue');

// Map stores client information
const rooms = new Map();

// User creates connection
io.on("connection", function (client) {
    let userRoomId;    
    console.log("user connected", client.id);

    // User wants to get all availble streams from the room
    client.on("slaveReadyGetStream", () => {
        client.to(userRoomId).emit('slaveWantsStream', client.id);
    });

    // User wants to start the stream
    client.on('startStream', () => {
        const { username } = getClientFromRoom(client, userRoomId);

        // Find another clients in the same room
        const slavesId = [...rooms.get(userRoomId).values()]
            .filter(c => c.userId !== client.id)
            .map(u => u.userId);

        client.to(userRoomId).emit('someoneInitPeerStream', { socketId: client.id, username });
        client.emit('startStreamAnswer', slavesId);
    });

    // User wants to send a stream to some slave
    client.on('startStreamTo', (slaveId) => {
        const { username } = getClientFromRoom(client, userRoomId);
        addTaskToDelayQueue(() => {
            io.to(slaveId).emit('someoneInitPeerStream', { socketId: client.id, username });
            client.emit('startStreamAnswer', [slaveId]);
        }, 1000);
    })

    // Get the offer back (master -> slave)
    client.on('masterOfferSlave', (offer) => {
        io.to(offer.slaveId).emit("slaveBackOfferMaster", offer)
    });

    // Get the answer back (slave -> master)
    client.on('slaveAnswerMaster', (answer) => {
        answer.slaveId = client.id;
        io.to(answer.socketId).emit("masterBackAnswerSlave", answer)
    })

    // User wants to login
    client.on('login', ({ username, roomId }) => {
        const userId = client.id;

        // If user doesn't have a room id, generate a random id for him
        if (!roomId) roomId = Math.random().toString(36).substring(7);
        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        userRoomId = roomId;

        rooms.get(roomId).set(userId, {
            userId,
            username,
        });

        // User joinig the room
        client.join(roomId);

        client.emit('loginSuccess', { roomId, username, userId, users: [...rooms.get(roomId).values()] });
        client.to(roomId).emit('userJoined', { username, userId });
    });

    // User wants to send message
    client.on('sendMessage', (message) => {
        const { username, userId } = getClientFromRoom(client, userRoomId);

        io.to(userRoomId).emit("newMessage", { text: message, username, userId, timestamp: new Date() });
    });

    // User decides to leave
    client.on('forceDisconnect', function () {
        removeClientFromRoom(client, userRoomId);
    });

    // The user socket has closed 
    client.on('disconnect', () => {
        console.log("user disconnected", client.id);
        removeClientFromRoom(client, userRoomId);
    });
});

// Get client information
const getClientFromRoom = (client, roomId) => {
    return rooms.get(roomId).get(client.id);
}

// Remove client from the room and tell everybody about that
const removeClientFromRoom = (client, userRoomId) => {
    if (!userRoomId) return;

    const user = getClientFromRoom(client, userRoomId);
    if (!user) return;

    const { username, userId } = user;

    client.to(userRoomId).emit('userLeaved', { userId, username });
    if (rooms.has(userRoomId)) rooms.get(userRoomId).delete(userId);
}

server.listen(3000);