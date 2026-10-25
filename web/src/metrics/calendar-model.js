export function minutesForEvents(events,selectedIds=new Set(events.map(event=>event.id))) {
  const intervals=events.filter(event=>selectedIds.has(event.id)).map(event=>[Date.parse(event.start),Date.parse(event.end)])
    .filter(([start,end])=>Number.isFinite(start)&&Number.isFinite(end)&&end>start)
    .sort((a,b)=>a[0]-b[0]);
  let total=0,start=null,end=null;
  for(const [from,to] of intervals){
    if(start==null){start=from;end=to;continue;}
    if(from<=end)end=Math.max(end,to);
    else{total+=end-start;start=from;end=to;}
  }
  if(start!=null)total+=end-start;
  return Math.min(1440,Math.round(total/60000));
}
