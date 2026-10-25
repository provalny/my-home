import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

// Visual preferences belong to this device, not to apartment data or undo history.
const KEY = 'iv:interface';
const PALETTES = [
  ['ocean','Океан','Синий и мягкий золотой свет'],
  ['emerald','Изумруд','Хвойный фон, мята и тёплые блики'],
  ['amethyst','Аметист','Сливовое стекло и лавандовый свет'],
  ['amber','Тёплый янтарь','Кофейные оттенки и медовые акценты'],
];
export function createInterfacePreferences(onChange) {
  let saved;
  try { saved=JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { saved={}; }
  const prefs={
    theme:['light','dark'].includes(saved?.theme)?saved.theme:'dark',
    material:['glass','matte','glow'].includes(saved?.material)?saved.material:'glass',
    palette:PALETTES.some(([id])=>id===saved?.palette)?saved.palette:'ocean',
    collapsed:typeof saved?.collapsed==='boolean'?saved.collapsed:innerWidth<850,
  };
  const controls=new Set();
  function apply() {
    const html=document.documentElement;
    html.dataset.inventoryTheme=prefs.theme;
    html.dataset.inventoryMaterial=prefs.material;
    html.dataset.inventoryPalette=prefs.palette;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',prefs.theme);
    for(const control of controls){
      if(!control.isConnected){controls.delete(control);continue;}
      for(const b of control.querySelectorAll('button[data-preference]')){
        b.setAttribute('aria-pressed',String(prefs[b.dataset.preference]===b.dataset.value));
      }
    }
  }
  function set(patch) {
    const previous={...prefs};Object.assign(prefs,patch);
    try { localStorage.setItem(KEY,JSON.stringify(prefs)); } catch { /* Preferences still work for this session. */ }
    apply();onChange?.(prefs,previous);
  }
  function settings() {
    function choices(label,key,options) {
      return h('div.iv-appearance-field',h('span',label),h('div.iv-appearance-options',{'role':'group','aria-label':label},...options.map(([value,title,glyph,description])=>{
        const b=h('button.iv-appearance-choice',{type:'button','data-preference':key,'data-value':value,'aria-pressed':String(prefs[key]===value),onclick:()=>set({[key]:value})},
          icon(glyph,19),h('span',h('strong',title),h('small',description)));
        return b;
      })));
    }
    const section=h('section.iv-card.iv-appearance-settings',h('h2','Внешний вид'),h('p.iv-muted','Тема, палитра и поверхности меняются сразу. Выбор сохраняется только на этом устройстве.'),
      choices('Тема','theme',[
        ['dark','Тёмная','moon','Дымчатое стекло и тёплые акценты'],
        ['light','Светлая','sun','Светлое стекло и мягкие тени'],
      ]),
      h('div.iv-appearance-field',h('span','Палитра'),h('div.iv-appearance-options.iv-palette-options',{'role':'group','aria-label':'Палитра'},...PALETTES.map(([value,title,description])=>
        h('button.iv-appearance-choice.iv-palette-choice',{type:'button','data-preference':'palette','data-value':value,'aria-pressed':String(prefs.palette===value),onclick:()=>set({palette:value})},
          h('span.iv-palette-swatch',{'data-palette-swatch':value,'aria-hidden':'true'}),h('span',h('strong',title),h('small',description)))))),
      choices('Поверхности','material',[
        ['glass','Liquid Glass','copy','Прозрачность, объёмные края и живые блики'],
        ['matte','Матовые','stop','Спокойные непрозрачные панели'],
        ['glow','Свечение','sparkles','Мягкая подсветка акцентов'],
      ]));
    controls.add(section);return section;
  }
  apply();return {prefs,set,settings};
}
