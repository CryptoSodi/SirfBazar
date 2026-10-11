const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = (path, dependencies, globals = {}) => {
  const target = {exports:{}};
  const source = ts.transpileModule(fs.readFileSync(require.resolve(path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module:target,exports:target.exports,require:name=>{if (!(name in dependencies)) throw Error('Unexpected import '+name);return dependencies[name];},...globals});
  return target.exports;
};
const labels = load('../lib/location-label.ts',{});

test('web entry and guest address creation do not silently select Lahore or Gulberg',()=>{
  const api=fs.readFileSync(require.resolve('../lib/api.ts'),'utf8');
  const address=fs.readFileSync(require.resolve('../components/AddressForm.tsx'),'utf8');
  const location=fs.readFileSync(require.resolve('../lib/location.tsx'),'utf8');
  assert.doesNotMatch(api,/city:\s*['"]Lahore['"]/);
  assert.doesNotMatch(address,/initial\?\.city\s*\?\?\s*['"]Lahore['"]/);
  assert.doesNotMatch(location,/FALLBACK_LOCATION|31\.40981|74\.28032/);
});

test('old coordinate labels and new unnamed pins are not mistaken for an address',()=>{
  for(const label of ['',null,undefined,'Pinned location','Pinned location (31.40981, 74.28032)']) assert.equal(labels.isUnnamedLocation(label),true);
  for(const label of ['Plot 72, Nasheman Iqbal','Nasheman Iqbal, Lahore']) assert.equal(labels.isUnnamedLocation(label),false);
  assert.equal(labels.manualLocationLabel('  Plot 72,   Street 2  '),'Plot 72, Street 2');
  assert.equal(labels.manualLocationLabel('x'.repeat(200)).length,160);
});
test('geocoding uses an actual address rather than a plus code and tolerates no results',()=>{
  assert.equal(labels.readableGeocodeResult([{formatted_address:'ABC+123 Lahore',types:['plus_code']},{formatted_address:'Nasheman Iqbal, Lahore',types:['sublocality']}]),'Nasheman Iqbal, Lahore');
  assert.equal(labels.readableGeocodeResult([]),null);
  assert.equal(labels.readableGeocodeResult([{formatted_address:'ABC+123 Lahore',types:['plus_code']}]),null);
});

function fixture({enabled=true,loaded=true}={}) {
  let effect;
  let state=null;
  const timers = new Map();
  let id=0;
  const requests=[];
  const saved=[];
  const jsx=(type,props)=>({type,props});
  const react={useState:()=>[state,next=>{state=next;}],useRef:current=>({current}),useEffect:fn=>{effect=fn;}};
  const components=load('../components/LocationControl.tsx',{
    react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
    '@react-google-maps/api':{useJsApiLoader:()=>({isLoaded:loaded,loadError:null})},
    '@/lib/api':{storeLocation:location=>saved.push(location)},
    '@/lib/maps':{GOOGLE_MAPS_API_KEY:'fixture',hasMapsKey:enabled},
    '@/lib/location-label':labels,'./Icons':{Icon:'Icon'},'./LocationControl.module.css':{default:{attribution:'attribution'}},
  },{
    google:{maps:{Geocoder:class{geocode(request){return new Promise((resolve,reject)=>requests.push({request,resolve,reject}));}}}},
    setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),
  });
  const location={latitude:31.4,longitude:74.28,label:'Pinned location (31.40000, 74.28000)'};
  const tree=components.LocationControl({location,onClick(){}});
  const [lookup,button]=tree.props.children;
  return {location,button,lookup,requests,saved,state:()=>state,start:()=>{lookup.type(lookup.props);return effect();},run:ms=>{for(const [key,t] of timers){if(t.ms===ms){timers.delete(key);t.fn();}}}};
}
test('legacy labels get a neutral header while resolving; no lookup without a key',()=>{
  const f=fixture();
  assert.equal(f.button.props.title,'Pinned location');
  assert.ok(f.lookup);
  assert.equal(fixture({enabled:false}).lookup,false);
});
test('lookup keeps the exact pin, persists its readable label after explicit confirmation, and ignores late results',async()=>{
  const f=fixture();const stop=f.start();f.run(500);
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].request)),{location:{lat:31.4,lng:74.28}});
  f.requests[0].resolve({results:[{formatted_address:'Street 2, Nasheman Iqbal, Lahore',types:['route']}]});
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.state().label,'Street 2, Nasheman Iqbal, Lahore');
  assert.equal(f.state().latitude,31.4);
  assert.deepEqual(JSON.parse(JSON.stringify(f.saved[0])),{latitude:31.4,longitude:74.28,label:'Street 2, Nasheman Iqbal, Lahore'});
  stop();
  const stale=fixture();const cancel=stale.start();stale.run(500);cancel();
  stale.requests[0].resolve({results:[{formatted_address:'Old address',types:['route']}]});
  await Promise.resolve();await Promise.resolve();assert.equal(stale.state(),null);
});
test('timeout and API refusal leave a usable fallback, with no retry loop',async()=>{
  const timed=fixture();timed.start();timed.run(500);timed.run(8000);
  timed.requests[0].resolve({results:[{formatted_address:'Too late',types:['route']}]});
  await Promise.resolve();await Promise.resolve();assert.equal(timed.state(),null);assert.equal(timed.requests.length,1);
  const denied=fixture();denied.start();denied.run(500);denied.requests[0].reject(Error('REQUEST_DENIED'));
  await Promise.resolve();await Promise.resolve();assert.equal(denied.state(),null);
});
