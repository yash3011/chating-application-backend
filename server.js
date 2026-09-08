const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*"
    }
});

app.use(express.json());
app.use(express.static("public"));

let rooms = {};

app.get("/health", (req,res)=>{
    res.json({status:"ok"});
});

app.post("/create-room", (req,res)=>{
    try{
    const roomCode = uuidv4().slice(0,6).toUpperCase();

    rooms[roomCode] = {
        users: []
    };

    res.status(201).json({roomCode});
    }catch(error){
        console.error("Room creation failed:", error);
        res.status(500).json({msg:"Unable to create a private room"});
    }
});

app.post("/join-room",(req,res)=>{

    const roomCode = String(req.body?.roomCode || "").trim().toUpperCase();

    if(!roomCode){
        return res.status(400).json({msg:"Room code is required"});
    }

    if(!rooms[roomCode]){
        return res.status(404).json({msg:"Room not found"});
    }

    if(rooms[roomCode].users.length >= 2){
        return res.status(403).json({msg:"Room full"});
    }

    res.json({success:true});
});

io.on("connection",(socket)=>{

    socket.on("join-room",(roomCode)=>{
        const normalizedRoom = String(roomCode || "").trim().toUpperCase();

        if(!rooms[normalizedRoom]){
            return socket.emit("chat-error", "This private room no longer exists.");
        }

        if(rooms[normalizedRoom].users.length >= 2){
            return socket.emit("chat-error", "This room already has two people in it.");
        }

        socket.join(normalizedRoom);
        socket.data.room = normalizedRoom;
        rooms[normalizedRoom].users.push(socket.id);

    });

    socket.on("send-message",(data)=>{
    const normalizedRoom = String(data?.room || "").trim().toUpperCase();
    const message = String(data?.message || "").trim();

    if(!normalizedRoom || !rooms[normalizedRoom] || socket.data.room !== normalizedRoom){
        return socket.emit("chat-error", "You are not connected to that private room.");
    }

    if(!message){
        return socket.emit("chat-error", "A blank message cannot be sent.");
    }

    if(message.length > 1000){
        return socket.emit("chat-error", "Messages must be 1000 characters or fewer.");
    }

    io.to(normalizedRoom).emit("receive-message",{
        message,
        sender:socket.id
    });

});

    socket.on("disconnect",()=>{
        const room = rooms[socket.data.room];
        if(!room) return;
        room.users = room.users.filter((userId)=>userId !== socket.id);
        if(room.users.length === 0) delete rooms[socket.data.room];
    });

});

app.use((error,req,res,next)=>{
    console.error("Unexpected server error:", error);
    res.status(500).json({msg:"Something went wrong on the server"});
});

server.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});