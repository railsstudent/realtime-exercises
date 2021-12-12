import http from "http";
import handler from "serve-handler";
import nanobuffer from "nanobuffer";

// these are helpers to help you deal with the binary data that websockets use
import objToResponse from "./obj-to-response.js";
import generateAcceptValue from "./generate-accept-value.js";
import parseMessage from "./parse-message.js";

let connections = [];
const msg = new nanobuffer(50);
const getMsgs = () => Array.from(msg).reverse();

msg.push({
  user: "brian",
  text: "hi",
  time: Date.now(),
});

// serve static assets
const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: "./frontend",
  });
});

/*
 *
 * your code goes here
 *
 */
server.on("upgrade", function(req, socket) {
  if (req.headers["upgrade"] !== "websocket") {
    // we only care about websockets
    socket.end("HTTP/1.1 400 Bad Request");
    return;
  }

  const acceptKey = req.headers["sec-websocket-key"];
  const acceptValue = generateAcceptValue(acceptKey);
  const headers = [
    "HTTP/1.1 101 Web Socket Protocol Handshake",
    "Upgrade: WebSocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptValue}`,
    "Sec-WebSocket-Protocol: json",
    "\r\n",
  ];

  // we are done sending headers and now we'll be sending data.
  socket.write(headers.join("\r\n"))

  socket.write(objToResponse({ msg: getMsgs() }))

  connections.push(socket)

  socket.on('data', (buffer) => {
    const message = parseMessage(buffer)
    if (message) {
      const { user, text } = message
      msg.push({
        user,
        text,
        time: Date.now(),
      })

      connections.forEach((s) => s.write(objToResponse({ msg: getMsgs() })));
    } else if (message === null) {
      // remove from my active connections
      socket.end();
    }    
  })

  // under socket.on('data'), inside the server.on('upgrade')
  socket.on("end", () => {
    connections = connections.filter((s) => s !== socket);
  })
})


const port = process.env.PORT || 8080;
server.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);
