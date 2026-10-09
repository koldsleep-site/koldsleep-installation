const NOTION_API='https://api.notion.com/v1';
const VERSION='2025-09-03';
const RAW_HTML='https://raw.githubusercontent.com/koldsleep-site/koldsleep-installation/main/archive/index.html';
const PAGE_DEFAULT='3e9875c0f5d880339306ffd41acc4e42';
const PHOTO_ID='3ef875c0-f5d8-80b4-bf0c-fcace0bb3121';
const LIMIT=1200;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const jsonHeaders={'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff'};
async function notionGet(route,env){
  for(let i=0;i<4;i++){
    const res=await fetch(NOTION_API+route,{headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':VERSION,Accept:'application/json'}});
    if(res.ok)return await res.json();
    if(res.status===429&&i<3){await sleep(Math.min(10,Math.max(1,Number(res.headers.get('retry-after'))||1))*1000);continue;}
    const errorPayload=await res.json().catch(()=>({}));throw new Error('Notion '+res.status+' '+String(errorPayload.code||'api_error')+' at '+route.split('?')[0]);
  }
  throw new Error('Notion rate limit');
}
function rich(items){
  return Array.isArray(items)?items.map(x=>({type:x.type,plain_text:x.plain_text??x.text?.content??'',href:x.href??x.text?.link?.url??null,annotations:x.annotations??{}})):[];
}
function simplify(b){
  const t=b.type,p=b[t]||{};
  const out={id:b.id,type:t,rich_text:rich(p.rich_text)};
  if(t==='child_page'){out.title=p.title||'Untitled';out.url='https://www.notion.so/'+b.id.replace(/-/g,'');}
  if(t==='image'||(t==='file'&&/\.(png|jpe?g|webp|gif|avif)$/i.test(p.name||''))){
    out.type='image';out.url=p.file?.url||p.external?.url||'';out.rich_text=rich(p.caption);
  }
  if(t==='to_do')out.checked=!!p.checked;
  return out;
}
async function childrenOf(id,env,depth,shared){
  if(depth>7)return [];
  const all=[];let cursor;
  do{
    const qs=new URLSearchParams({page_size:'100'});
    if(cursor)qs.set('start_cursor',cursor);
    const data=await notionGet('/blocks/'+id+'/children?'+qs,env);
    for(const b of data.results||[]){
      if(++shared.total>LIMIT)throw new Error('Block limit exceeded');
      const obj=simplify(b);
      if(b.has_children&&!['child_page','child_database'].includes(b.type)){
        obj.children=await childrenOf(b.id,env,depth+1,shared);
      }
      all.push(obj);
    }
    cursor=data.has_more?data.next_cursor:null;
  }while(cursor);
  return all;
}
async function archive(env){
  const bare=String(env.NOTION_PAGE_ID||PAGE_DEFAULT).replace(/-/g,'');
  if(!/^[a-f0-9]{32}$/i.test(bare))throw new Error('Bad page ID');
  const id=bare.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
  const page=await notionGet('/pages/'+id,env);
  const blocks=await childrenOf(id,env,0,{total:0});
  return {title:'koldsleep Archive',source:'Notion',edited_at:page.last_edited_time||null,blocks};
}
async function homepage(ctx){
  const origin=await fetch(RAW_HTML,{cf:{cacheEverything:true,cacheTtl:300}});
  if(!origin.ok)return new Response('Archive source temporarily unavailable',{status:502});
  return new Response(origin.body,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
}
async function photo(env){
  if(!env.NOTION_TOKEN)return new Response('Notion connection required',{status:503});
  try{
    const b=await notionGet('/blocks/'+PHOTO_ID,env);
    if(!['image','file'].includes(b.type))return new Response('Photo not found',{status:404});
    const file=b[b.type]||{};
    const url=file.file?.url||file.external?.url;
    if(!url||!url.startsWith('https://'))return new Response('Photo unavailable',{status:404});
    const origin=await fetch(url);
    if(!origin.ok)return new Response('Photo temporarily unavailable',{status:502});
    const mime=origin.headers.get('content-type')||'image/png';
    if(!mime.startsWith('image/'))return new Response('Invalid photo',{status:502});
    return new Response(origin.body,{status:200,headers:{'content-type':mime,'cache-control':'public,max-age=300,s-maxage=300','x-content-type-options':'nosniff'}});
  }catch(e){console.error('Photo fetch:',e.message);return new Response('Photo temporarily unavailable',{status:502});}
}
export default {async fetch(request,env,ctx){
  const pathname=new URL(request.url).pathname;
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  if(pathname==='/api/status')return Response.json({connected:!!env.NOTION_TOKEN,source:'Notion',cache_seconds:300},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(pathname==='/api/rude-nerd-read-cat')return photo(env);
  if(pathname==='/api/archive'){
    if(!env.NOTION_TOKEN)return new Response(JSON.stringify({error:'Notion integration is not connected'}),{status:503,headers:{...jsonHeaders,'cache-control':'no-store'}});
    const key=new Request(new URL('/api/archive',request.url).toString());
    const cache=caches.default;
    const cached=await cache.match(key);
    if(cached)return cached;
    try{
      const body=JSON.stringify(await archive(env));
      const response=new Response(body,{status:200,headers:{...jsonHeaders,'cache-control':'public,max-age=60,s-maxage=300'}});
      ctx.waitUntil(cache.put(key,response.clone()));
      return response;
    }catch(e){console.error('Notion sync:',e.message);const sourceUnshared=/Notion 404 object_not_found at \/pages\//.test(String(e?.message||''));return new Response(JSON.stringify({error:'Notion sync temporarily unavailable',reason:sourceUnshared?'SOURCE_PAGE_NOT_SHARED':'NOTION_API_ERROR',action:sourceUnshared?'Share koldsleep Archive with the Notion integration configured in NOTION_TOKEN':undefined}),{status:502,headers:{...jsonHeaders,'cache-control':'no-store'}});}
  }
  if(pathname==='/'||pathname==='/index.html')return homepage(ctx);
  return new Response('Not found',{status:404});
}};