'use strict';

const express = require('express');
var bodyParser = require('body-parser');
const fs = require('fs');

run().catch(err => console.log(err));

async function run() {
   const app = express();
   app.use(bodyParser.urlencoded({ extended: true }));
   app.use(bodyParser.json());
   app.use(bodyParser.text());

   app.post('/sseAsync', async function (req, res) {
      console.log('request', req.method, req.body)
      console.log('/sseAsync');
      res.set({
         'Cache-Control': 'no-cache',
         'Content-Type': 'text/event-stream',
         'Connection': 'keep-alive'
      });
      res.flushHeaders();

      // Tell the client to retry every 3 seconds if connectivity is lost
      res.write('retry: 3000\n\n');
      let count = 1;

      while (count <= 10) {
         await new Promise(resolve => setTimeout(resolve, 1000));
         console.log('Emit', ++count);
         // Emit an SSE that contains the current 'count' as a string
         res.write(`data: ${count}\n\n`);
      }
      res.end();
   });


   const index = fs.readFileSync('./public/index.html', 'utf8');
   app.get('/', (req, res) => res.send(index));

   const sse = fs.readFileSync('../../EventSourceExtra.js', 'utf8');
   app.get('/EventSourceExtra.js', (req, res) => res.send(sse));

   await app.listen(3000);

   console.log('Listening at http://localhost:3000')
}