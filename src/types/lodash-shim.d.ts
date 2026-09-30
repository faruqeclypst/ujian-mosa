// Deklarasi tipe ringan untuk sub-import lodash (menghindari dependensi @types/lodash).
declare module "lodash/isEqual" {
  function isEqual(value: any, other: any): boolean;
  export default isEqual;
}
