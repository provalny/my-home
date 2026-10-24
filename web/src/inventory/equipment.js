// Shared editable specifications; these values never drive model geometry.
export const EQUIPMENT_FIELDS = {
  pcCase: {
    'Процессор': ['Intel Core i5','Intel Core i7','Intel Core i9','AMD Ryzen 5','AMD Ryzen 7','AMD Ryzen 9'],
    'Видеокарта (GPU)': ['NVIDIA GeForce RTX','AMD Radeon RX','Встроенная графика'],
    'ОЗУ': ['16 ГБ','32 ГБ','64 ГБ','128 ГБ'],
    'Накопитель': ['SSD 512 ГБ','SSD 1 ТБ','SSD 2 ТБ','SSD 4 ТБ'],
    'Материнская плата': [], 'Блок питания': ['650 Вт','750 Вт','850 Вт','1000 Вт'],
    'Охлаждение': ['Воздушное','Жидкостное'],
  },
  macBook: {
    'Процессор': ['Apple M1','Apple M2','Apple M3','Apple M4'],
    'Видеокарта (GPU)': ['Встроенная Apple GPU'],
    'ОЗУ': ['8 ГБ','16 ГБ','24 ГБ','32 ГБ','48 ГБ','64 ГБ'],
    'Накопитель': ['SSD 256 ГБ','SSD 512 ГБ','SSD 1 ТБ','SSD 2 ТБ'],
  },
  simCockpit: {
    'База руля': ['Direct Drive','Ременная','Шестерёнчатая'],
    'КПП': ['H-образная','Секвентальная','Без КПП'],
    'Руль': ['Круглый','GT','Formula'],
    'Педали': ['2 педали','3 педали','Load Cell','Гидравлические'],
    'Ковш': ['Фиксированный','С регулировкой наклона'],
  },
};

EQUIPMENT_FIELDS.simCockpitTriple = EQUIPMENT_FIELDS.simCockpit;
