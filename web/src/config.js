// Loads and normalises a floor plan ("home.json"). Everything the 3D scene and the UI
// know about the apartment comes from this one document, so swapping the file swaps the home.

const LIGHT_TYPES = ['ceiling', 'pendant', 'spots', 'floor', 'table', 'strip'];
const WALLS = ['north', 'south', 'east', 'west'];

export class ConfigError extends Error {}

export const LIGHT_KINDS = LIGHT_TYPES;

// A lamp or an AC is real when it is linked to a device of a connected platform:
// `link: { service, id }` (Home Assistant, Philips Hue, Apple Home) or, for Smart Life,
// `tuya: { deviceId }`. Кондиционер's `sensor: { service, id }` is a thermometer for its room.
export const LINK_FIELDS = ['tuya', 'link', 'sensor'];

export function linkOf(d) {
  if (d?.link?.service && d.link.id) return { service: d.link.service, id: d.link.id };
  if (d?.tuya?.deviceId) return { service: 'smartlife', id: d.tuya.deviceId };
  return null;
}

export const isLinked = (d) => Boolean(linkOf(d));

/** The platforms House Control can link to, in the order the editor lists them. */
export const SERVICES = {
  smartlife: { name: 'Smart Life', short: 'Smart Life' },
  homeassistant: { name: 'Home Assistant', short: 'Home Assistant' },
  hue: { name: 'Philips Hue', short: 'Hue' },
  homekit: { name: 'Apple Home', short: 'Apple Home' },
};
export const FLOOR_KINDS = ['oak', 'walnut', 'tile', 'stone', 'carpetWhite', 'carpetGrey', 'laminateLightOak'];

// The plan exactly as written on disk (the editor works on this form).
export async function loadRawConfig() {
  const boot = window.__HOUSE_BOOT__;
  if (boot?.config) return boot.config;
  const plan = (boot?.plan !== 'custom' && boot?.plan) || new URLSearchParams(location.search).get('plan') || 'home';
  const res = await fetch(`./plans/${plan}.json`);
  if (!res.ok) throw new ConfigError(`План «${plan}» не найден (HTTP ${res.status})`);
  try {
    return await res.json();
  } catch (e) {
    throw new ConfigError(`Не удалось прочитать план «${plan}»: ${e.message}`);
  }
}

export async function loadConfig() {
  return normalize(await loadRawConfig());
}

function need(cond, msg) {
  if (!cond) throw new ConfigError(msg);
}

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

export function normalize(raw) {
  need(raw && typeof raw === 'object', 'План должен быть объектом JSON');
  need(Array.isArray(raw.rooms), 'В плане нужен список комнат');

  const ids = new Set();
  const unique = (id, what) => {
    need(typeof id === 'string' && id, `${what}: не указан идентификатор`);
    need(!ids.has(id), `Повторяющийся идентификатор «${id}»`);
    ids.add(id);
  };

  const rooms = raw.rooms.map((r) => {
    unique(r.id, 'Комната');
    need(Array.isArray(r.rect) && r.rect.length === 4 && r.rect.every(Number.isFinite),
      `Комната «${r.id}»: укажите положение, ширину и глубину`);
    const [x, z, w, d] = r.rect;
    need(w > 0 && d > 0, `Комната «${r.id}»: ширина и глубина должны быть больше нуля`);
    return { id: r.id, name: r.name || r.id, x, z, w, d, floor: r.floor || 'oak' };
  });
  const roomIds = new Set(rooms.map((r) => r.id));

  const openings = (raw.openings || []).map((o, i) => {
    need(isPoint(o.from) && isPoint(o.to), `Проём №${i + 1}: укажите начало и конец`);
    need(o.from[0] === o.to[0] || o.from[1] === o.to[1], `Проём №${i + 1} должен быть направлен вдоль стены`);
    return { type: o.type || 'door', from: o.from, to: o.to, sill: o.sill ?? 0.85, head: o.head ?? 2.1 };
  });

  const lights = (raw.lights || []).map((l) => {
    unique(l.id, 'Светильник');
    need(roomIds.has(l.room), `Светильник «${l.id}»: комната «${l.room}» не найдена`);
    need(LIGHT_TYPES.includes(l.type), `Светильник «${l.id}»: неизвестный тип «${l.type}»`);
    need(isPoint(l.pos), `Светильник «${l.id}»: укажите координаты X и Z`);
    return {
      ...l,
      name: l.name || l.id,
      rot: l.rot || 0,
      capabilities: l.capabilities || [], // plain smart plugs: on/off only
    };
  });

  const acs = (raw.acs || []).map((a) => {
    unique(a.id, 'Кондиционер');
    need(roomIds.has(a.room), `Кондиционер «${a.id}»: комната «${a.room}» не найдена`);
    need(isPoint(a.pos), `Кондиционер «${a.id}»: укажите координаты X и Z`);
    need(WALLS.includes(a.wall), `Кондиционер «${a.id}»: выберите стену`);
    return { ...a, name: a.name || a.id, y: a.y ?? 2.2, min: a.min ?? 16, max: a.max ?? 30 };
  });

  const scenes = (raw.scenes || []).map((s) => {
    need(typeof s.id === 'string' && s.id, 'У сцены не указан идентификатор');
    return { id: s.id, name: s.name || s.id, icon: s.icon || 'sun', lights: s.lights || {}, acs: s.acs || {} };
  });

  const minX = rooms.length?Math.min(...rooms.map((r) => r.x)):0;
  const minZ = rooms.length?Math.min(...rooms.map((r) => r.z)):0;
  const maxX = rooms.length?Math.max(...rooms.map((r) => r.x + r.w)):6;
  const maxZ = rooms.length?Math.max(...rooms.map((r) => r.z + r.d)):4;

  return {
    name: raw.name || 'Home',
    wallHeight: raw.wallHeight ?? 2.6,
    interiorWallHeight: raw.interiorWallHeight ?? 1.25,
    camera: { azimuth: raw.camera?.azimuth ?? 34, elevation: raw.camera?.elevation ?? 47 },
    outdoorTemp: raw.outdoorTemp ?? 27,
    rooms,
    openings,
    furniture: raw.furniture || [],
    lights,
    acs,
    scenes,
    bounds: { minX, minZ, maxX, maxZ },
  };
}
