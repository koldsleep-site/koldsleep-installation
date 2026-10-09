const BASE='https://raw.githubusercontent.com/koldsleep-site/koldsleep-site/1b90bad513e8a3a64f9e01ed0e216e6e1f477e97/';
const MIME={'.html':'text/html; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const ASSETS=new Set(['index.html','k.png','favicon.ico','favicon-16.png','favicon-32.png','favicon-48.png','favicon-180.png','favicon-192.png','favicon-512.png']);
export default {async fetch(request){
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405});
  const path=new URL(request.url).pathname.slice(1)||'index.html';
  if(!ASSETS.has(path))return new Response('Not Found',{status:404});
  const response=await fetch(BASE+path,{cf:{cacheEverything:true,cacheTtl:3600}});
  if(!response.ok)return new Response('Legacy site source unavailable',{status:502});
  const ext=path.substring(path.lastIndexOf('.'));
  return new Response(response.body,{status:200,headers:{'content-type':MIME[ext]||'application/octet-stream','cache-control':'public,max-age=600','x-content-type-options':'nosniff'}});
}};