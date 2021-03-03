const httpServer = require("http").createServer();

const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:8080","https://asclepius.xyz/"
  }
});


const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

const { InMemorySessionStore } = require("./sessionStore");
const sessionStore = new InMemorySessionStore();

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  if (sessionID) {
    const session = sessionStore.findSession(sessionID);
    if (session) {
      socket.sessionID = sessionID;
      socket.userID = session.userID;
      socket.did = session.did;
      return next();
    }
  }
  const did = socket.handshake.auth.did;
  if (!did) {
    return next(new Error("invalid did"));
  }
  socket.sessionID = randomId();
  socket.userID = randomId();
  socket.did = did;
  next();
});


io.on("connection", async (socket) => {

  // persist session
  sessionStore.saveSession(socket.sessionID, {
    userID: socket.userID,
    did: socket.did,
    connected: true,
  });

  // emit session details
  socket.emit("session", {
    sessionID: socket.sessionID,
    userID: socket.userID,
  });

  
  // join the "userID" room
  socket.join(socket.userID);

  // forward the private message to the right recipient (and to other tabs of the sender)
  socket.on("private message", ({ Pname, cid, to }) => {
    const message = {
      Pname,
      cid,
      from: socket.userID,
      to,
    };
    socket.to(to).to(socket.userID).emit("private message", message);
  });

});

httpServer.listen(3001, () => {
  console.log('listening on *:3001');
});

// socket.on("private message", ({ content, to }) => {
//   socket.to(to).emit("private message", {
//     content,
//     from: socket.id,
//   });
// });