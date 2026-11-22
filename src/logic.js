export const uid=()=>crypto.randomUUID();
export const parseTags=(value='')=>value.split(',').map(x=>x.trim()).filter(Boolean);
export const toMarkdown=(title, records)=>'# '+title+'\n\n'+records.map(r=>'## '+(r.title||'Untitled')+'\n'+Object.entries(r).filter(([k])=>!['id','createdAt'].includes(k)).map(([k,v])=>'**'+k+'**: '+v).join('\n')).join('\n\n');
export const csv=(records)=>{const keys=[...new Set(records.flatMap(Object.keys))];return [keys,...records.map(r=>keys.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')};
