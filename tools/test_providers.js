const fs=require('fs'),vm=require('vm');
function load(f,hostImpl){const ctx={host:hostImpl,Date,Math,JSON,eval:undefined};vm.createContext(ctx);vm.runInContext(fs.readFileSync(f,'utf8'),ctx);return ctx;}
const logs=[];
// ---- hdfbest ----
{
 const pages={
  'https://www.hdfilmizle.best/film/batman/':{status:404,text:''},
  'https://www.hdfilmizle.best/bolum/batman/':{status:200,text:`<div data-post="123"></div><script>var _hdfNonce_ = 'abc';</script>`},
  'POST https://www.hdfilmizle.best/ajax/videosrc/?id=123&lang=tr&mr=0':{status:200,text:`{"sources":[{"src":"https:\\/\\/srv.x.cfd\\/a\\/master.m3u8"}],"tracks":[{"src":"https:\\/\\/cdn\\/tur.vtt","kind":"x","label":"T\\u00fcrk\\u00e7e"},{"src":"https:\\/\\/cdn\\/eng-forced.vtt","label":"English"}]}`}
 };
 const h={log:m=>logs.push(m),fetch:(u,o)=>pages[(o&&o.method==='POST'?'POST ':'')+u]||{status:500,text:''}};
 const c=load(__dirname+'/../providers-repo/providers/hdfilmizlebest.js',h);
 const r=vm.runInContext('resolve({slug:"film/batman"})',c);
 console.log(JSON.stringify(r));
}
// ---- cehennem ----
{
 const filmHtml=`<div class="alternative-links" data-lang="tr"><button class="alternative-link" data-video="11">Close (HDrip Xbet)</button><button class="alternative-link" data-video="22">Rapid</button></div>`;
 const direct='https://cdn.example.com/hls/master.m3u8?e=9999999999';
 const pages={
  'https://www.hdfilmcehennemi.nl/bridget/':{status:200,text:filmHtml},
  'https://www.hdfilmcehennemi.nl/video/22/':{status:200,text:'{"data":"<iframe data-src=\\"https:\\/\\/www.hdfilmcehennemi.nl\\/x\\/?rapidrame_id=77\\"></iframe>"}'},
  'https://www.hdfilmcehennemi.nl/rplayer/77':{status:200,text:`<script>jwplayer("a").setup({sources:[{file:so3}],tracks:[{"file":"\\/subs\\/tr.vtt","label":"T\\u00fcrk\\u00e7e"}]});var so3="${direct}";</script>`}
 };
 const h={log:m=>logs.push(m),fetch:(u)=>pages[u]||{status:500,text:''}};
 const c=load(__dirname+'/../providers-repo/providers/cehennem.js',h);
 // eval is overridden to undefined above in sandbox; give indirect eval via vm context's own eval
 const ctx2=vm.createContext({host:h,Date,Math,JSON});vm.runInContext(fs.readFileSync(__dirname+'/../providers-repo/providers/cehennem.js','utf8'),ctx2);
 try{console.log(vm.runInContext('JSON.stringify(resolve({slug:"bridget"}))',ctx2));}catch(e){console.log('ERR',e.message)}
 // packed test
 const packed=`eval(function(p,a,c,k,e,d){while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c])}}return p}('0 1="2://3.4/5.6";',7,7,'var|so3|https|a|b|c|m3u8'.split('|'),0,{}))`;
 console.log(vm.runInContext(`unpackDeanEdwards(${JSON.stringify(packed)})`,ctx2));
 console.log(vm.runInContext(`decodeDc(${JSON.stringify(packed)})`,ctx2));
}
console.log(logs.join('\n'));
