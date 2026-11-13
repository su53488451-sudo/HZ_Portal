import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.woff2':'font/woff2','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg','.task':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){res.writeHead(403);return res.end('Forbidden');}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(8026,'127.0.0.1',()=>console.log('Forms of Presence: http://127.0.0.1:8026'));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8026 is already in use. Open http://127.0.0.1:8026 or stop the previous server.':e);process.exitCode=1;});
