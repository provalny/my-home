export const VEHICLE_MODELS={trailSuv:'Экспедиционный внедорожник',vestaSwCross2019:'Lada Vesta SW Cross · 2019'};

export function vehicleModelType(car={}){
  if(Object.hasOwn(VEHICLE_MODELS,car.modelType))return car.modelType;
  return /vesta|веста/i.test([car.name,car.brand,car.model].filter(Boolean).join(' '))?'vestaSwCross2019':'trailSuv';
}
