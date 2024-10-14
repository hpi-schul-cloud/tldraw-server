/* tslint:disable */
/* eslint-disable */
/**
 * Schulcloud-Verbund-Software Server API
 * This is v3 of Schulcloud-Verbund-Software Server. Checkout /docs for v1.
 *
 * The version of the OpenAPI document: 3.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


/**
 * 
 * @export
 */
export const Action = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type Action = typeof Action[keyof typeof Action];


export function instanceOfAction(value: any): boolean {
    for (const key in Action) {
        if (Object.prototype.hasOwnProperty.call(Action, key)) {
            if (Action[key as keyof typeof Action] === value) {
                return true;
            }
        }
    }
    return false;
}

export function ActionFromJSON(json: any): Action {
    return ActionFromJSONTyped(json, false);
}

export function ActionFromJSONTyped(json: any, ignoreDiscriminator: boolean): Action {
    return json as Action;
}

export function ActionToJSON(value?: Action | null): any {
    return value as any;
}

export function ActionToJSONTyped(value: any, ignoreDiscriminator: boolean): Action {
    return value as Action;
}

