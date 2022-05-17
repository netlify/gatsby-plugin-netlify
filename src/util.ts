// Accounting for true, false, and new Boolean()
export const isBoolean = (val: any): boolean => typeof val === 'boolean' ||
    (
      typeof val === 'object' &&
      val !== null &&
      typeof val.valueOf() === 'boolean'
    )

export const flow =
  funcs =>
  (...args) =>
    funcs.reduce((prev, fnc) => [fnc(...prev)], args)[0]
