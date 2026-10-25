import {h} from '../ui/dom.js';
import * as T from './model.js';
export function travelTags(d,n){const rows=T.memberships(d,n.id);return rows.length?h('div.tr-item-tags',h('span','Изъято в поход'),...rows.map(t=>h('span','Добавлено в '+t.name))):null;}
