export const APP_ICONS=[
  {id:'aurora',name:'Северное сияние'},
  {id:'sunset',name:'Тёплый вечер'},
  {id:'orbit',name:'Орбита'},
  {id:'forest',name:'Тихий лес'},
];
export const appIconPath=id=>`./icons/${APP_ICONS.some(i=>i.id===id)?id:'aurora'}.png`;
