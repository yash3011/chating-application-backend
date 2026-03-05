const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

let rooms = {};

app.post("/create-room", (req,res)=>{

    const roomCode = uuidv4().slice(0,6);

    rooms[roomCode] = {
        users: []
    };

    res.json({roomCode});
});

app.post("/join-room",(req,res)=>{

    const {roomCode} = req.body;

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

        if(!rooms[roomCode]) return;

        if(rooms[roomCode].users.length >= 2) return;

        socket.join(roomCode);
        rooms[roomCode].users.push(socket.id);

    });

    socket.on("send-message",(data)=>{

    io.to(data.room).emit("receive-message",{
        message:data.message,
        sender:socket.id
    });

});

});

server.listen(3000,()=>{
    console.log("Server running on port 3000");
});