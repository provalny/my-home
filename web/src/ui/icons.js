import {
  Search, WashingMachine, Microwave, CookingPot, Refrigerator, Bath, ShowerHead, Toilet, PanelsTopLeft, Archive, LibraryBig, Fence, CircleDot, Warehouse, Monitor, RectangleEllipsis, Baby, Gamepad2, Coffee, Flower2,
  createElement, Trophy, Power, Sun, Sofa, Film, Moon, DoorOpen, LampCeiling, LampFloor, LampDesk, Lightbulb,
  Snowflake, Flame, Droplets, Fan, Wind, Leaf, ChevronDown, ChevronLeft, Plus, Minus, Thermometer,
  SlidersHorizontal, Check, House, Settings2, AirVent, Sparkles, FolderOpen, Plug, Lamp, SunDim, SunMedium,
  Tv, BedDouble, Palette, RefreshCw, X,
  ShieldCheck, Link2, Copy, MessageSquareText, BookOpen, Terminal, RotateCcw, Globe, Laptop, Clock, Box, Download,
  Undo2, Activity, KeyRound, ArrowUpRight, Camera, Square,
  HouseWifi, Smartphone, Radar, CircleCheck, CircleAlert, ChevronRight, Unlink, LoaderCircle, Router,
  List, Trash2, Scan, Redo2, Map as MapIcon, DoorClosed, Armchair, MoreHorizontal, Shirt, Utensils, Wrench, Dumbbell, Pill, SprayCan, FileText, PawPrint, Tent, Paintbrush, ShoppingBasket, Car, Footprints, Milk,
} from 'lucide';

const ICONS = {
  search:Search, washer:WashingMachine, microwave:Microwave, stove:CookingPot, fridge:Refrigerator, bath:Bath, shower:ShowerHead, toilet:Toilet, wardrobe:PanelsTopLeft, dresser:Archive, shelf:LibraryBig, rack:Fence, tire:CircleDot, warehouse:Warehouse, monitor:Monitor, desk:RectangleEllipsis, baby:Baby, games:Gamepad2, coffee:Coffee, flower:Flower2,
  trophy:Trophy,
  clothes:Shirt, dishes:Utensils, tools:Wrench, sport:Dumbbell, medicine:Pill, cleaning:SprayCan, documents:FileText, pets:PawPrint, outdoor:Tent, hobby:Paintbrush, food:ShoppingBasket, car:Car, shoes:Footprints, milk:Milk,
  power: Power, sun: Sun, sofa: Sofa, film: Film, moon: Moon, door: DoorOpen,
  ceiling: LampCeiling, pendant: Lamp, spots: Lightbulb, floor: LampFloor, table: LampDesk, strip: Sparkles,
  cool: Snowflake, heat: Flame, dry: Droplets, fan: Fan, auto: RefreshCw, wind: Wind, leaf: Leaf,
  down: ChevronDown, back: ChevronLeft, plus: Plus, minus: Minus, thermo: Thermometer,
  sliders: SlidersHorizontal, check: Check, home: House, settings: Settings2, ac: AirVent,
  folder: FolderOpen, plug: Plug, dim: SunDim, bright: SunMedium, tv: Tv, bed: BedDouble,
  palette: Palette, sparkles: Sparkles, close: X,
  shield: ShieldCheck, link: Link2, copy: Copy, chat: MessageSquareText, book: BookOpen, terminal: Terminal,
  rotate: RotateCcw, globe: Globe, laptop: Laptop, clock: Clock, box: Box, download: Download, undo: Undo2,
  activity: Activity, key: KeyRound, external: ArrowUpRight, camera: Camera, stop: Square,
  homeassistant: HouseWifi, phone: Smartphone, radar: Radar, ok: CircleCheck, alert: CircleAlert,
  next: ChevronRight, unlink: Unlink, spinner: LoaderCircle, bridge: Router, bulb: Lightbulb,
  list: List, trash: Trash2, fit: Scan, redo: Redo2, map: MapIcon, opening: DoorClosed, furniture: Armchair, more: MoreHorizontal, Shirt, Utensils, Wrench, Dumbbell, Pill, SprayCan, FileText, PawPrint, Tent, Paintbrush, ShoppingBasket, Car, Footprints, Milk,
};

export function icon(name, size = 18, stroke = 1.8) {
  const el = createElement(ICONS[name] || ICONS.sparkles);
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('stroke-width', stroke);
  el.classList.add('icon');
  return el;
}
