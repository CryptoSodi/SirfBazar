// Actual native API source; fake transport/storage/providers, no network or credentials.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('node:module').createRequire(require('node:path').resolve(__dirname,'../apps/api/package.json'))('typescript'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setTimeout(r,0));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const auth=id=>({accessToken:'access-'+id,refreshToken:'refresh-'+id,user:{id}});
function fixture(app){
 const values=new Map();let hold=null,readHold=null,fetcher=async()=>response(200,{});
 const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v),multiSet:async p=>{if(hold)await hold.promise;p.forEach(([k,v])=>values.set(k,v))},multiRemove:async ks=>ks.forEach(k=>values.delete(k)),removeItem:async k=>values.delete(k)};
 const imports={'@react-native-async-storage/async-storage':storage,'./friendly-error':{friendlyError:m=>m||'failed'},'./push':{registerForPush:async()=>{},unregisterPush:async()=>{}},'./auth-flow':{authDestination:()=> 'Tabs'},'./customer-events':{publishCustomerEvent:()=>{}},'react-native':{Platform:{OS:'web'}},'expo-constants':{expoConfig:{}},'./customer-flow':{resolveApiUrl:()=> 'http://fixture.test/api'},'./credentials':{readCredential:async k=>{const value=values.get(k)||null;if(readHold&&k==='sb.accessToken')await readHold.promise;return value},writeCredential:async(k,v)=>{if(hold)await hold.promise;values.set(k,v)},removeCredential:async k=>values.delete(k)}};
 function load(name){const compiled=ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../apps/'+app+'/lib/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={};vm.runInNewContext(compiled,{exports,require:id=>{if(!(id in imports))throw Error(id);return imports[id]},process:{env:{EXPO_PUBLIC_API_URL:'http://fixture.test/api'}},fetch:(...a)=>fetcher(...a),setTimeout,clearTimeout,AbortController});return exports}
 imports['./toast-session']=load('toast-session');
 return{api:load('api'),session:imports['./toast-session'],hold:()=>hold=deferred(),readHold:()=>readHold=deferred(),fetch:f=>fetcher=f}
}
const deadline=setTimeout(()=>{throw Error('Native session harness timed out');},15000);
let pass=0;const ok=label=>{pass++;console.log('PASS',label)};
(async()=>{
 for(const app of ['merchant-app','rider-app','customer-app']){
  const f=fixture(app);await f.api.storeAuth(auth('A'));const gate=f.hold(),save=f.api.storeAuth(auth('B'));let bearer;
  f.fetch(async(u,i)=>{bearer=i.headers.authorization;return response(200,{owner:'B'})});
  const request=f.api.api.get('/profile'),user=f.api.getUser(),logged=f.api.isLoggedIn();await tick();assert.equal(bearer,undefined);
  gate.resolve();await save;await request;assert.equal(bearer,'Bearer access-B');assert.equal((await user).id,'B');assert.equal(await logged,true);ok(app+' queued B coherent request/user/login');
 }
 for(const app of ['merchant-app','rider-app','customer-app'])for(const status of [200,401]){
  const f=fixture(app);await f.api.storeAuth(auth('A'));const gate=deferred(),started=deferred();let logouts=0;
  f.fetch(async url=>{if(url.endsWith('/auth/refresh-token')){started.resolve();return gate.promise}if(url.endsWith('/auth/logout')){logouts++;return response(200,{})}return response(401,{})});
  const result=f.api.api.get('/profile').then(()=>({ok:true}),e=>({error:e.message}));await started.promise;await f.api.storeAuth(auth('B'));gate.resolve(response(status,auth('A')));
  assert.match((await result).error,/session changed/i);assert.equal((await f.api.getUser()).id,'B');assert.equal(logouts,0);ok(app+' late A refresh'+status+' retains B');
 }
 let f=fixture('customer-app');await f.api.storeAuth(auth('A'));const gate=f.hold(),save=f.api.storeAuth(auth('B'));let sent;
 f.fetch(async(u,i)=>{sent=JSON.parse(i.body).refreshToken;return response(200,auth('B'))});
 const renew=f.api.renewSession();await tick();assert.equal(sent,undefined);gate.resolve();await save;await renew;assert.equal(sent,'refresh-B');assert.equal((await f.api.getUser()).id,'B');ok('customer pending B direct refresh uses refresh-B');
 for(const method of ['isLoggedIn','getAccessToken']){
  f=fixture('customer-app');await f.api.storeAuth(auth('A'));const read=f.readHold(),result=f.api[method]();await tick();const clear=f.api.clearAuth();read.resolve();assert.equal(await result,method==='isLoggedIn'?false:null);await clear;ok('customer delayed '+method+' rejects stale A read');
 }
 for(const app of ['customer-app','merchant-app','rider-app'])for(const status of [200,401]){
  const f=fixture(app),gate=deferred(),started=deferred();let refreshes=[],logouts=0;
  f.fetch(async(url,init)=>{if(url.endsWith('/auth/refresh-token')){const token=JSON.parse(init.body).refreshToken;refreshes.push(token);if(token==='refresh-A'){started.resolve();return gate.promise}return response(200,{...auth('B'),accessToken:'access-B2',refreshToken:'refresh-B2'})}if(url.endsWith('/auth/logout')){logouts++;return response(200,{})}return init.headers.authorization==='Bearer access-B2'?response(200,{owner:'B'}):response(401,{})});
  await f.api.storeAuth(auth('A'));const a=f.api.api.get('/profile').then(v=>({ok:v}),e=>({error:e.message}));await started.promise;await f.api.storeAuth(auth('B'));
  const b=f.api.api.get('/profile').then(v=>({ok:v}),e=>({error:e.message}));await tick();assert.ok(refreshes.includes('refresh-B'),'B starts refresh before A settles');gate.resolve(response(status,auth('A')));
  assert.match((await a).error,/session changed/i);assert.equal((await b).ok.owner,'B');assert.equal((await f.api.getUser()).id,'B');assert.equal(logouts,0);assert.equal(refreshes.filter(x=>x==='refresh-B').length,1);ok(app+' overlapping A/B refresh late'+status);
 }
 for(const app of ['customer-app','merchant-app','rider-app']){
  const f=fixture(app),gate=deferred(),started=deferred();let refreshes=0;
  await f.api.storeAuth(auth('A'));
  f.fetch(async(url,init)=>{
   if(url.endsWith('/auth/refresh-token')){refreshes++;started.resolve();return gate.promise}
   return init.headers.authorization==='Bearer access-A2'?response(200,{owner:'A'}):response(401,{});
  });
  const requests=[f.api.api.get('/one'),f.api.api.get('/two')];
  await started.promise;await tick();assert.equal(refreshes,1);
  gate.resolve(response(200,{...auth('A'),accessToken:'access-A2',refreshToken:'refresh-A2'}));
  const results=await Promise.all(requests);assert.equal(results[0].owner,'A');assert.equal(results[1].owner,'A');assert.equal(refreshes,1);assert.equal((await f.api.getUser()).id,'A');ok(app+' same-session parallel refresh succeeds once');
 }
 for(const app of ['customer-app','merchant-app','rider-app'])for(const failure of ['offline',503,401]){
  const f=fixture(app);await f.api.storeAuth(auth('A'));let logouts=0,refreshes=0;
  f.fetch(async url=>{
   if(url.endsWith('/auth/logout')){logouts++;return response(200,{})}
   if(url.endsWith('/auth/refresh-token')){refreshes++;if(failure==='offline')throw Error('simulated offline');return response(failure,{})}
   return response(401,{});
  });
  await assert.rejects(f.api.api.get('/profile'));assert.equal(refreshes,1);
  assert.equal((await f.api.getUser())?.id,failure===401?undefined:'A');assert.equal(logouts,failure===401?1:0);ok(app+' refresh '+failure+(failure===401?' clears invalid session':' preserves session'));
 }
 // Real pure invalidation signal; this queue is harness-owned, not rendered UI.
 for(const app of ['customer-app','merchant-app','rider-app']){
  const f=fixture(app);let queue=['old session'],invalidations=0;
  const unsubscribe=f.session.onSessionInvalidated(()=>{queue=[];invalidations++});
  await f.api.storeAuth(auth('A'));assert.equal(queue.length,0);assert.equal(invalidations,1);
  queue.push('A notice');await f.api.storeAuth(auth('B'));assert.equal(queue.length,0);assert.equal(invalidations,2);
  queue.push('B notice');await f.api.clearAuth();assert.equal(queue.length,0);assert.equal(invalidations,3);
  unsubscribe();f.session.invalidateSessionToasts();assert.equal(invalidations,3);ok(app+' actual pure toast invalidation fires on auth switch/logout and unsubscribes');
 }
 clearTimeout(deadline);console.log('RESULT',pass,'passed, 0 failed');
})().catch(e=>{clearTimeout(deadline);console.error(e);process.exitCode=1});
