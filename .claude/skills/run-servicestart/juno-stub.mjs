/* global process, console */
// Stand-in for Juno on :8888. Answers every request with success and appends
// the request to a log, so email sends (POST /email/send) can be inspected.
import fs from "node:fs";
import http from "node:http";

const logFile = process.argv[2] ?? "/tmp/servicestart/juno-requests.log";

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      fs.appendFileSync(logFile, `${req.method} ${req.url}\n${body}\n\n`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, statusCode: 200 }));
    });
  })
  .listen(8888, () => console.log(`juno stub on :8888, logging to ${logFile}`));
