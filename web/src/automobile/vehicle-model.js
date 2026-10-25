export function vehicleModelType(car={}){
  if(['trailSuv','vestaSwCross2019'].includes(car.modelType))return car.modelType;
  return /vesta|веста/i.test([car.name,car.brand,car.model].filter(Boolean).join(' '))?'vestaSwCross2019':'trailSuv';
}
