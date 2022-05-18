// Accounting for true, false, and new Boolean()
export const isBoolean = (val: any): boolean => typeof val === 'boolean' ||
    (
      typeof val === 'object' &&
      val !== null &&
      typeof val.valueOf() === 'boolean'
    )

type Header = string
type Headers = Header[] 

// TODO: better return type
type FlowableFunction = (...flowArgs: Headers) => any;
/**
 * 
 * @param functions - takes in an array of functions
 * @returns The function documented below
 */
export const flow =
<FlowReturnType = Promise<any>>(functions: FlowableFunction[]) =>
  /**
   * 
   * @param headers - In our case, headers is only {pluginOptions.headers} (in build-headers-program.ts), 
   * but in this generic implementation could take in any number of arguments
   * 
   * @returns The evaluated return value of the last function from the array of functions provided in the
   *  {functions} parameter
   */
  (...headers: Headers): FlowReturnType => functions.reduce((resultOfPrev, func) => [func(...resultOfPrev)], headers)[0]

  