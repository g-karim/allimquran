/* Private photos are bounded immutable parts in the owner's existing durable outbox.
   There are no public File URLs, separate upload sessions or shared account caches. */
(function (root) {
  "use strict";
  const size = 32768, limit = 8 * 1024 * 1024;
  const loading = new Map();
  const fail = code => Object.assign(new Error(code), {code});
  const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const guard = stamp => root.AllimStorage.guarded(stamp, [], "readonly", () => {});
  async function encode(record) {
    if (!(record.blob instanceof Blob) || !record.blob.size || record.blob.size > limit) throw fail("image_size_invalid");
    if (![record.width,record.height].every(n => Number.isInteger(n) && n > 0 && n <= 20000)) throw fail("image_dimensions_invalid");
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const mime = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? "image/png" : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "image/webp" : null;
    if (!mime) throw fail("image_format_invalid");
    const image = root.crypto.randomUUID(), hash = Array.from(new Uint8Array(await root.crypto.subtle.digest("SHA-256", bytes))).map(b => b.toString(16).padStart(2, "0")).join("");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const data = root.btoa(binary), parts = [];
    for (let i = 0; i < data.length; i += size) parts.push({kind: "lawh_image_part", id: image + "/" + i / size, value: {data: data.slice(i, i + size)}});
    return {parts, photo: {image_id: image, parts: parts.length, bytes: bytes.length, sha256: hash, mime, width: record.width, height: record.height, file_name: Array.from(String(record.fileName || "lawh-page")).slice(0, 255).join("")}};
  }
  function decode(photo, records) {
    const parts = new Map(records.filter(r => r.kind === "lawh_image_part" && !r.deleted && r.value?.data).map(r => [r.id, r.value.data]));
    const data = [];
    for (let i = 0; i < photo.parts; i++) {
      const value = parts.get(photo.image_id + "/" + i);
      if (!value) return null;
      const binary = root.atob(value); data.push(Uint8Array.from(binary, c => c.charCodeAt(0)));
    }
    return new Blob(data, {type: photo.mime});
  }
  async function save(record) {
    const storage = root.AllimStorage, stamp = storage.stamp();
    const snapshot = await storage.snapshot(), current = snapshot.records.find(r => r.kind === "lawh_photo" && r.id === record.id);
    const encoded = await encode(record);
    await guard(stamp);
    const intents = encoded.parts.concat({kind: "lawh_photo", id: record.id, value: encoded.photo, base_version: current?.version || 0});
    if (stamp.scope.startsWith("guest:") && current?.value) for (let i = 0; i < current.value.parts; i++) intents.push({kind: "lawh_image_part", id: current.value.image_id + "/" + i, action: "delete"});
    return storage.mutateMany(intents,stamp);
  }
  async function cache(records, stamp) {
    const storage = root.AllimStorage;
    await storage.guarded(stamp,["records"],"readwrite",async stores=>{
      for(const row of records){
        if(row.kind!=="lawh_image_part" || !row.value?.data)continue;
        const old=await request(stores.records.get([stamp.scope,row.kind,row.id]));
        if(!old || old.deleted || row.version && old.version!==row.version)continue;
        const next={...old,value:row.value};delete next.payload_omitted;
        await request(stores.records.put(next));
      }
    });
  }
  async function hydrate(photo, stamp) {
    const storage=root.AllimStorage,key=stamp.scope+":"+stamp.generation+":"+photo.image_id;
    if(loading.has(key))return loading.get(key);
    const work=(async()=>{
      while(true){
        const snapshot=await storage.snapshot();await guard(stamp);
        const present=new Set(snapshot.records.filter(r=>r.kind==="lawh_image_part"&&!r.deleted&&r.value?.data).map(r=>r.id));
        let first=0;while(first<photo.parts&&present.has(photo.image_id+"/"+first))first++;
        if(first===photo.parts)return;
        if(!stamp.scope.startsWith("account:")||storage.state!=="account_ready")throw fail("photo_unavailable_offline");
        const page=await storage.api("image_parts",{image_id:photo.image_id,after_index:first},stamp);
        await cache(page.records,stamp);
      }
    })().finally(()=>loading.delete(key));
    loading.set(key,work);return work;
  }
  async function list({limit:count=12,id=null}={}) {
    const storage = root.AllimStorage, stamp = storage.stamp(), snapshot = await storage.snapshot();
    const photos=snapshot.records.filter(r=>r.kind==="lawh_photo"&&!r.deleted).sort((a,b)=>a.id.localeCompare(b.id));
    const visible=id?photos.filter(r=>r.id===id):photos.slice(0,count);
    const cached=new Set(snapshot.records.filter(r=>r.kind==="lawh_image_part"&&!r.deleted&&r.value?.data).map(r=>r.id));
    await Promise.all(visible.map(async row=>{if(Array.from({length:row.value.parts},(_,i)=>row.value.image_id+"/"+i).some(id=>!cached.has(id)))await hydrate(row.value,stamp).catch(()=>{});}));
    const current=await storage.snapshot();await guard(stamp);
    const progress = root.AllimLearning.project(current.records, root.AllimAccountUI?.catalogue || {}, current.scope?.startsWith("guest:") && !current.learningMigrated ? current.legacy.learn || {} : {});
    const records = visible.map(row => {
      const photo = row.value, unit = progress.heartMushaf.lawhPages[row.id] || {}, [surahId, ayahNumber] = row.id.split(":").map(Number);
      const verification = current.records.find(r => r.kind === "lawh_verification" && r.id === row.id && !r.deleted)?.value;
      return {id: row.id, surahId, ayahNumber, blob: decode(photo, current.records), fileName: photo.file_name, fileType: photo.mime, width: photo.width, height: photo.height, verifiedAt: verification?.image_sha256 === photo.sha256 ? verification.verified_at : "", readCount: unit.readCount || 0, recallCount: unit.recallCount || 0, updatedAt: unit.updatedAt || ""};
    });
    records.total=photos.length;
    await guard(stamp);
    return records;
  }
  async function hydrateAll() {
    const storage=root.AllimStorage,stamp=storage.stamp(),snapshot=await storage.snapshot(),missing=[];
    const photos=snapshot.records.filter(r=>r.kind==="lawh_photo"&&!r.deleted).concat(snapshot.records.filter(r=>r.kind==="conflict"&&!r.deleted&&r.value.status==="open"&&r.value.target_kind==="lawh_photo").map(r=>({id:r.value.target_id,value:r.value.proposed_value})));
    for(const row of photos){
      try{await hydrate(row.value,stamp);}catch(error){if(error.code==="owner_changed")throw error;missing.push(row.id);}
    }
    return missing;
  }
  async function remove(id) {
    const storage = root.AllimStorage, stamp = storage.stamp(), snapshot = await storage.snapshot();
    const row = snapshot.records.find(r => r.kind === "lawh_photo" && r.id === id && !r.deleted);
    if (!row) return;
    const intents = [{kind: "lawh_photo", id, action: "delete", base_version: row.version}];
    if (stamp.scope.startsWith("guest:")) for (let i = 0; i < row.value.parts; i++) intents.push({kind: "lawh_image_part", id: row.value.image_id + "/" + i, action: "delete"});
    await guard(stamp);
    return storage.mutateMany(intents,stamp);
  }
  async function legacy() {
    if (!root.indexedDB) return [];
    const opening = root.indexedDB.open("allim-lawh-library-v1", 1);
    opening.onupgradeneeded = () => opening.transaction.abort(); // Do not create an empty old database.
    let db;
    try { db = await request(opening); } catch (_) { return []; }
    try { return db.objectStoreNames.contains("pages") ? await request(db.transaction("pages").objectStore("pages").getAll()) : []; }
    finally { db.close(); }
  }
  root.AllimLawh = {encode, decode, save, list, get: async id => (await list({id}))[0] || null, remove, legacy, cache, hydrate, hydrateAll};
})(window);
