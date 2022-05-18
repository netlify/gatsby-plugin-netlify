// Accounting for true, false, and new Boolean()
export const isBoolean = (val: any): boolean => typeof val === 'boolean' ||
    (
      typeof val === 'object' &&
      val !== null &&
      typeof val.valueOf() === 'boolean'
    )

/**
 * 
 * @param functions - takes in an array of functions
 * @returns The function documented below
 */
export const flow =
functions =>
  /**
   * 
   * @param args - In our case, args is only {pluginOptions.headers} (in build-headers-program.ts), 
   * but in this generic implementation could take in any number of arguments
   * @returns The evaluated return value of the last function from the array of functions provided in the
   *  {functions} parameter
   */
  (...args) =>
  functions.reduce((prev, fnc) => [fnc(...prev)], args)[0]
