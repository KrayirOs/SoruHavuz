import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{try{if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/'||pathname==='')pathname='/index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT)||file.includes('..')){res.writeHead(403);return res.end('Forbidden');}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')return res.end();res.end(data);}catch(e){res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.code==='ENOENT'?'Not Found':'Server Error');}});
const port=Number(process.env.PORT||8080);server.listen(port,()=>console.log(`SoruHavuzu static server: http://localhost:${port}`));
