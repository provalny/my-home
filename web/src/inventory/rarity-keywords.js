// Approved title dictionary. Categories and field values never enter the matcher.
const rules=[];
function add(rarity,priority,entries,options={}) {
  for(const entry of entries)rules.push({rarity,priority,all:[entry.split('|')],...options});
}
function brand(rarity,entries,options={}) { add(rarity,1,entries,{brand:true,...options}); }
function phrase(rarity,entries,options={}) { add(rarity,2,entries,options); }

add('uncommon',0,[
  'книга','блокнот','ежедневник','термос','рюкзак','чехол','настольная лампа',
  'сковорода','кастрюля','полотенце','плед','набор отвёрток','коврик для йоги',
]);
brand('rare',[
  'Lenovo|леново','ASUS|асус','Acer|эйсер','Samsung|самсунг','Logitech|лоджитек','TP-Link|TPLINK|тп линк',
  'JBL|джибиэль','AKG','Audio-Technica|AudioTechnica|аудио техника','FiiO|фио',
  'Xbox|иксбокс','Nintendo Switch|нинтендо свитч','Bosch|бош','Electrolux|электролюкс','LG|элджи','Philips|филипс',
  'Nike|найк','Adidas|адидас','New Balance|нью бэланс','Vans|ванс','Casio|касио',
  'Tefal|тефаль','Fiskars|фискарс','Zwilling|цвиллинг','Makita|макита','DeWalt|де волт','Wera|вера',
  'Quechua|кечуа','Naturehike|нейчерхайк','LEGO|лего',
]);
brand('rare',['Samsonite|самсонайт','Osprey|оспрей'],{accessorySafe:true});
brand('rare',['IKEA|икеа'],{furnitureSafe:true});
add('rare',0,[
  'штатив','монопод','софтбокс','фоторюкзак','умная лампа','бонсай','витраж','матча',
  'велосипед','сноуборд','гиря','удилище','артбук|арт бук','атлас','энциклопедия',
  'тонометр','небулайзер','глюкометр','ирригатор','пароочиститель','ультразвуковая ванна',
  'паспорт','диплом','аэрограф','синтезатор','автокормушка','фонтан-поилка','GPS-ошейник|GPS ошейник',
  'видеорегистратор','автосканер','динамометрический ключ','мультитул','металлоискатель','бинокль',
]);
add('rare',0,[
  'механическая клавиатура','руль Thrustmaster|руль трастмастер',
  'льняное бельё','мериносовый плед','зерновой кофе','кленовый сироп','треккинговые палки|трекинговые палки',
  'виниловая пластинка','электрическая зубная щётка|электрическая зубная щетка',
  'перьевая ручка','настольная игра','швейная машина','MIDI-клавиатура|миди клавиатура','электрогитара',
]);
add('rare',0,['стол с электроподъёмом|стол с электроподъемником'],{furnitureSafe:true});
brand('epic',[
  'DJI|диджай|диджиай|ди джи ай','Canon|кэнон','Sony|сони','Apple|эппл|эпл|MacBook|макбук','Audeze|аудезе|аудизи|одизи',
  'Alienware|элиенвер','Wacom|ваком','Ubiquiti|убиквити',
  'Nikon|никон','Fujifilm|фуджифильм','Panasonic|панасоник','GoPro|го про|гоупро','Insta360|инста360','Sigma|сигма','Tamron|тамрон',
  'Sennheiser|сенхайзер|зенхайзер','Beyerdynamic|бейердинамик','Shure|шур','RME','Universal Audio',
  'PlayStation|плейстейшен','Steam Deck|стим дек','Fanatec|фанатек','Simagic|симэджик',
  'Miele|миле','Dyson|дайсон','KitchenAid|китченэйд',
  "Arc'teryx|Arcteryx|арк терикс",'Patagonia|патагония','Stone Island|стоун айленд','Canada Goose|канада гус',
  'Tissot|тиссо','Longines|лонжин','Montblanc|монблан','Nanoleaf|нанолиф','Artemide','Flos','Frette',
  'Le Creuset|ле крезе','Staub|стауб','Wüsthof|Wusthof|вюстхоф',
  'Festool|фестул','Hilti|хилти','Knipex|книпекс','Fluke|флюк',
  'Garmin|гармин','Wahoo|ваху','Tacx','MSR','Hilleberg|хиллеберг',
  'Bambu Lab|BambuLab|бамбу лаб','Prusa|пруса','Fender|фендер','Gibson|гибсон','Nord|норд','Copic|копик','Bernina|бернина',
  'Litter-Robot|LitterRobot|литтер робот',
]);
brand('epic',['Herman Miller|HermanMiller','Steelcase|стилкейс','Secretlab|секретлаб'],{furnitureSafe:true});
phrase('epic',[
  'ASUS ROG|асус рог','Galaxy Z Fold','Philips Hue|филипс хью','Philips Lumea|филипс люмеа',
  'Dyson Airwrap|дайсон эйрврап','Braun IPL|браун IPL','LEGO Technic|лего техник',
],{brand:true});
phrase('epic',[
  'кофемашина Jura|кофемашина юра','очки Ray-Ban|очки RayBan|очки рей бен',
  'золотое кольцо','Monstera Thai Constellation|монстера тай констеллейшен',
  'натуральный шёлк','кашемировый плед','натуральная ваниль','чёрная икра',
  'карбоновый велосипед','спутниковый коммуникатор','пуховый спальник',
  'первое издание','книга с автографом','номерной экземпляр',
  'портативный УЗИ-сканер|портативный УЗИ сканер','профессиональный стетоскоп',
  'поломоечная машина','моющий экстрактор','паропылесос','патент на изобретение',
  'договор купли-продажи квартиры','умный аквариум','автосканер Launch|автосканер лаунч',
  'автобокс Thule|автобокс туле','тепловизионная камера','телескоп с автонаведением','цифровой микроскоп',
]);
add('epic',1,['шафран','трюфель','тепловизор','3D-принтер|3д принтер|3Dprinter','VR-шлем|VR очки|виар шлем|виар очки']);
// Generic equipment descriptions must not demote an already legendary MOZA.
add('epic',1,['кокпит с трипл-скрином|кокпит с трипл скрином|кокпит с тремя экранами']);
brand('legendary',[
  'Leica|камера лейка|фотоаппарат лейка','MOZA|моза','Hasselblad|хассельблад','Phase One|PhaseOne|фейз ван','ARRI|арри',
],{priority:2});
phrase('legendary',[
  'STAX SR-X9000|STAX SRX9000','Focal Utopia|фокал утопия','Sennheiser HE 1|Sennheiser HE1|сенхайзер HE1',
  'часы Rolex|часы ролекс','часы Patek Philippe|часы патек филипп',
  'часы Audemars Piguet|часы одемар пиге','рояль Steinway|рояль стейнвей',
],{brand:true});
rules.push({rarity:'legendary',priority:3,brand:true,all:[
  ['Audeze','аудезе','аудизи','одизи'],['LCD-4','LCD4','LCD-5','LCD5'],
]});
rules.push({rarity:'legendary',priority:3,all:[['первое издание'],['автограф']]});

// Expansion approved on 25 October: 121 epic and 37 legendary entries.
brand('epic',[
  'OM System','Pentax|пентакс','Ricoh GR|рико GR','Zeiss|цейс','Voigtländer|Voigtlander','Laowa|лаова','Viltrox|вилтрокс','Samyang|самьянг',
  'Godox|годокс','Aputure|апутур','Nanlite|нанлайт','Profoto|профото',
  'HIFIMAN|хайфаймен','Meze Audio|мезе аудио','Dan Clark Audio','Austrian Audio','Focal|фокал','STAX|стакс','Astell&Kern|AstellKern',
  'Neumann|нойман','Genelec|дженелек','ADAM Audio','KEF','Dynaudio|динаудио','Chord Electronics',
  'Razer|рейзер','Corsair|корсар','Elgato|элгато','EIZO|эйзо',
  'Formlabs','Raise3D','Ultimaker','Voron','Snapmaker','Elegoo','Anycubic|эникубик',
  'Smeg|смег','Gaggenau|гаггенау','Liebherr|либхер','Asko|аско','Roborock|роборок','Dreame|дрими',
  "De'Longhi|DeLonghi|де лонги",'Sage','Breville','Rancilio','Rocket Espresso','Eureka',
  'Mammut','Norrøna|Norrona','Fjällräven|Fjallraven','Haglöfs|Haglofs','Rab','Klättermusen|Klattermusen','La Sportiva','Scarpa',
  'Trek','Specialized','Canyon','Cervélo|Cervelo','Pinarello','Burton',
  'Oris','Sinn','Nomos','Hamilton','Metabo','Fein','Proxxon','Stabila','Mitutoyo',
  'Roland|роланд','Korg|корг','Moog|муг','Sequential','Elektron','Arturia|артурия','Teenage Engineering',
  'Schmincke','Sennelier','Winsor & Newton|Winsor and Newton','Pfaff','Husqvarna Viking',
  'Hot Toys','Sideshow','Bandai Metal Build','Warhammer 40000|Warhammer 40K|Warhammer 40 000',
  'Petkit','PetSafe','SureFeed','Fluval',
]);
brand('epic',['Rimowa','Tumi'],{accessorySafe:true});
phrase('epic',['штатив Gitzo|Gitzo штатив','штатив Manfrotto|Manfrotto штатив'],{brand:true,accessorySafe:true,subject:'штатив'});
phrase('epic',[
  'MSI Raider','Lenovo Legion','Samsung Odyssey','Valve Index','Meta Quest','HTC Vive','Pimax','ROG Ally',
  'Simucube 2 Sport','Simucube 2 Pro','Asetek SimSports','Heusinkveld Sprint','VRS DirectForce Pro','Cube Controls',
  'Seiko Prospex','Casio MR-G|Casio MRG','Victorinox Swiss Tool|Victorinox SwissTool','Akai MPC',
  'Brother Innov-is|Brother Innovis',
],{brand:true});
rules.push({rarity:'epic',priority:2,brand:true,all:[['BenQ']],series:/^sw(?:\d[\p{L}\p{N}]*)?$/u});
phrase('epic',[
  'кресло Haworth Fern|Haworth Fern','кресло HÅG Capisco|HAG Capisco',
  'кресло Humanscale Freedom|Humanscale Freedom','кресло Okamura Contessa|Okamura Contessa',
  'стол USM Haller|USM Haller','диван BoConcept|BoConcept диван',
],{brand:true,furnitureSafe:true});
brand('legendary',[
  'McIntosh','Accuphase','dCS','Esoteric','Vacheron Constantin','A. Lange & Söhne|A Lange Sohne',
  'Breguet','Blancpain','Jaeger-LeCoultre|JaegerLeCoultre','Cartier|картье','Van Cleef & Arpels|Van Cleef and Arpels',
],{priority:2});
phrase('legendary',[
  'Sony Alpha 1 II|Sony A1 II|Sony α1 II','Canon EOS R1','Nikon Z9|Nikon Z 9',
  'Fujifilm GFX100 II|Fujifilm GFX100II|Fujifilm GFX 100 II','RED V-RAPTOR|RED VRAPTOR',
  'Sony VENICE 2','Blackmagic URSA Cine',
  'Audeze CRBN2|Audeze CRBN 2','HIFIMAN Susvara','HIFIMAN Susvara Unveiled',
  'ABYSS AB-1266 Phi TC|ABYSS AB1266 Phi TC','Dan Clark Audio Expanse','Meze Elite',
  'Simucube 2 Ultimate','Heusinkveld Ultimate+|Heusinkveld Ultimate Plus','платформа D-BOX|D-BOX платформа',
  'La Marzocco GS3|La Marzocco GS 3','Slayer Single Group','Rocket R Nine One|Rocket R9 One|Rocket R9One',
  'рояль Bösendorfer|рояль Bosendorfer','рояль Fazioli',
],{brand:true});
phrase('legendary',[
  'Vitra Eames Lounge Chair','Fritz Hansen Egg','Cassina LC4|Cassina LC 4',
  'B&B Italia Camaleonda','Poltrona Frau Vanity Fair',
],{brand:true,furnitureSafe:true});

// Inflections are explicit: substring stemming would turn unrelated words into brands.
const FORMS={
  книга:'книги книгу книгой книге книг', блокнот:'блокноты блокнота блокнотов', ежедневник:'ежедневники ежедневника',
  термос:'термосы термоса термосов', рюкзак:'рюкзаки рюкзака рюкзаков', чехол:'чехлы чехла чехлов',
  настольная:'настольные настольный настольного настольной', лампа:'лампы лампу ламп',
  сковорода:'сковороды сковороду сковород', кастрюля:'кастрюли кастрюлю кастрюль',
  полотенце:'полотенца полотенец', плед:'пледы пледа пледов', набор:'наборы набора наборов',
  отвёрток:'отвертки отвёртки отверток', коврик:'коврики коврика ковриков',
  штатив:'штативы штатива штативов', монопод:'моноподы монопода', софтбокс:'софтбоксы софтбокса', фоторюкзак:'фоторюкзаки',
  умная:'умный умное умные умного умной', механическая:'механические механический', клавиатура:'клавиатуры клавиатуру',
  руль:'рули руля рулей', стол:'столы стола столов', льняное:'льняные льняной льняного', бельё:'белья',
  мериносовый:'мериносовые мериносового', зерновой:'зернового', кленовый:'кленового', сироп:'сиропа сиропы',
  треккинговые:'треккинговая треккинговый трекинговые', палки:'палка палок', виниловая:'виниловые виниловый', пластинка:'пластинки пластинок',
  электрическая:'электрические электрический', зубная:'зубные зубной', щётка:'щетка щетки щётки щеток щёток',
  перьевая:'перьевые перьевой', ручка:'ручки ручек', игра:'игры игр игру', швейная:'швейные', машина:'машины машину машин',
  велосипед:'велосипеды велосипеда', сноуборд:'сноуборды', гиря:'гири гирь', удилище:'удилища удилищ',
  артбук:'артбуки', атлас:'атласы', энциклопедия:'энциклопедии', тонометр:'тонометры', небулайзер:'небулайзеры',
  глюкометр:'глюкометры', ирригатор:'ирригаторы', пароочиститель:'пароочистители', ванна:'ванны',
  паспорт:'паспорта паспортов', диплом:'дипломы диплома', аэрограф:'аэрографы', синтезатор:'синтезаторы',
  автокормушка:'автокормушки', поилка:'поилки', ошейник:'ошейники', видеорегистратор:'видеорегистраторы',
  автосканер:'автосканеры', ключ:'ключи ключей', мультитул:'мультитулы', металлоискатель:'металлоискатели', бинокль:'бинокли',
  кофемашина:'кофемашины', очки:'очков', золотое:'золотые золотой золотого', кольцо:'кольца колец',
  натуральный:'натуральные натуральная натуральное натурального натуральной', шёлк:'шелк шелка шёлка',
  кашемировый:'кашемировые кашемирового', чёрная:'черная черные чёрные черной чёрной', икра:'икры',
  карбоновый:'карбоновые карбонового', спутниковый:'спутниковые спутникового', коммуникатор:'коммуникаторы',
  пуховый:'пуховые пухового', спальник:'спальники', первое:'первого первые', издание:'издания изданий',
  автограф:'автографом автографа автографы', номерной:'номерные номерного', экземпляр:'экземпляры экземпляра',
  портативный:'портативные портативного', сканер:'сканеры', профессиональный:'профессиональные профессионального',
  стетоскоп:'стетоскопы', поломоечная:'поломоечные', моющий:'моющие моющего', экстрактор:'экстракторы',
  паропылесос:'паропылесосы', патент:'патенты патента', договор:'договоры договора', аквариум:'аквариумы',
  автобокс:'автобоксы', тепловизионная:'тепловизионные тепловизионный', камера:'камеры камеру',
  телескоп:'телескопы', цифровой:'цифровые цифрового', микроскоп:'микроскопы',
  шафран:'шафрана', трюфель:'трюфели трюфеля', тепловизор:'тепловизоры', принтер:'принтеры принтера',
  шлем:'шлемы шлема', кокпит:'кокпиты кокпита', экран:'экрана экранами экраны',
  ремешок:'ремешки ремешка', кабель:'кабели кабеля', адаптер:'адаптеры адаптера', амбушюры:'амбушюр амбушюра',
  зарядка:'зарядки', зарядное:'зарядные', устройство:'устройства', упаковка:'упаковки', футляр:'футляры',
  крышка:'крышки', кейс:'кейсы', переходник:'переходники', накладка:'накладки', сумка:'сумки сумок',
  наушники:'наушников', монитор:'мониторы', ноутбук:'ноутбуки', компьютер:'компьютеры', телефон:'телефоны',
  пылесос:'пылесосы', рояль:'рояли рояля',
  тумба:'тумбы тумбу тумбой тумбе тумб', тумбочка:'тумбочки тумбочку тумбочек',
  комод:'комоды комода', стеллаж:'стеллажи стеллажа', шкаф:'шкафы шкафа шкафов шкафчик шкафчики',
  полка:'полки полок полку', кресло:'кресла кресел', стул:'стулья стула стульев',
  диван:'диваны дивана', кровать:'кровати кроватей', банкетка:'банкетки', пуф:'пуфы',
  скамья:'скамьи скамейка скамейки', подставка:'подставки', стойка:'стойки стойке', этажерка:'этажерки',
  кухня:'кухни кухню', стенка:'стенки', обувница:'обувницы',
};
const plain=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/['’`]/g,'');
const forms=new Map();
for(const [base,variants]of Object.entries(FORMS))for(const word of [base,...variants.split(' ')])forms.set(plain(word),plain(base));
const tokens=value=>(plain(value).match(/[\p{L}\p{N}]+|\+/gu)||[]).map(word=>forms.get(word)||word);
const compiled=rules.map(rule=>({...rule,all:rule.all.map(group=>group.map(tokens))}));
const ranks={uncommon:1,rare:2,epic:3,legendary:4};
const contains=(haystack,needle)=>haystack.some((_,i)=>needle.every((word,j)=>haystack[i+j]===word));
const accessories=new Set(tokens('чехол ремешок кабель адаптер амбушюры зарядка зарядное упаковка футляр крышка кейс переходник накладка сумка рюкзак фоторюкзак фотосумка штатив монопод софтбокс стекло пленка case cover sleeve pouch bag backpack cable adapter adaptor strap earpads charger packaging cap'));
const devices=new Set(tokens('наушники гарнитура гарнитуры камера фотоаппарат монитор ноутбук компьютер телефон смартфон телевизор пылесос кофемашина принтер кокпит часы рояль велосипед микрофон микрофоны усилитель цап акустика колонка гитара электрогитара синтезатор клавиатура мышь роутер headphones headset camera monitor laptop computer phone printer cockpit watch watches bicycle microphone guitar keyboard'));
const furniture=new Set(tokens('тумба тумбочка комод стеллаж стол шкаф полка кресло стул диван кровать банкетка пуф скамья подставка стойка этажерка гарнитур кухня стенка обувница cabinet nightstand sideboard dresser desk table chair armchair sofa bed shelf shelving rack stand'));
const titleCache=new Map();

function matchTitle(name) {
  let title=tokens(name);
  const first=set=>{const index=title.findIndex(word=>set.has(word));return index<0?Infinity:index;};
  const accessory=first(accessories),device=first(devices),piece=first(furniture);
  const isAccessory=accessory<Math.min(device,piece);
  const isFurniture=piece<Math.min(device,accessory);
  if(isAccessory||isFurniture){
    const target=title.findIndex(word=>['для','под','совместимый','совместим','for','compatible'].includes(word));
    if(target>=0)title=title.slice(0,target);
  }
  if(isAccessory){
    // A cover for a tripod is still a cover when "для" was omitted.
    const target=title.findIndex((word,i)=>i>accessory&&(accessories.has(word)||devices.has(word)||furniture.has(word)));
    if(target>=0)title=title.slice(0,target);
  }
  let best=null;
  for(const rule of compiled){
    if(isFurniture&&!rule.furnitureSafe)continue;
    if(isAccessory&&rule.brand&&!rule.accessorySafe)continue;
    if(rule.subject&&(!isAccessory||title[accessory]!==rule.subject))continue;
    if(rule.series&&!title.some(word=>rule.series.test(word)))continue;
    if(!rule.all.every(group=>group.some(needle=>contains(title,needle))))continue;
    if(!best||rule.priority>best.priority||rule.priority===best.priority&&ranks[rule.rarity]>ranks[best.rarity])best=rule;
  }
  return best?.rarity||null;
}

// Bounded cache: catalog, chart and Excel share title results without retaining old documents.
export function titleRarity(name) {
  const key=String(name??'');
  if(titleCache.has(key))return titleCache.get(key);
  const result=matchTitle(key);
  if(titleCache.size>=4096)titleCache.clear();
  titleCache.set(key,result);
  return result;
}
