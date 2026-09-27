import "./load-env.js";
import { createServer } from "node:http";
import { handleRequest } from "../routes/index.js";

const PORT = Number(process.env.PORT) || 4000;

const server = createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`LocalLoop backend on http://localhost:${PORT}`);
});
