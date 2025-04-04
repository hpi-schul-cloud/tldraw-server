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

import { mapValues } from '../runtime.js';
/**
 * 
 * @export
 * @interface ApiValidationError
 */
export interface ApiValidationError {
    /**
     * The response status code.
     * @type {number}
     * @memberof ApiValidationError
     */
    code: number;
    /**
     * The error type.
     * @type {string}
     * @memberof ApiValidationError
     */
    type: string;
    /**
     * The error title.
     * @type {string}
     * @memberof ApiValidationError
     */
    title: string;
    /**
     * The error message.
     * @type {string}
     * @memberof ApiValidationError
     */
    message: string;
    /**
     * The error details.
     * @type {object}
     * @memberof ApiValidationError
     */
    details?: object;
}

/**
 * Check if a given object implements the ApiValidationError interface.
 */
export function instanceOfApiValidationError(value: object): value is ApiValidationError {
    if (!('code' in value) || value['code'] === undefined) return false;
    if (!('type' in value) || value['type'] === undefined) return false;
    if (!('title' in value) || value['title'] === undefined) return false;
    if (!('message' in value) || value['message'] === undefined) return false;
    return true;
}

export function ApiValidationErrorFromJSON(json: any): ApiValidationError {
    return ApiValidationErrorFromJSONTyped(json, false);
}

export function ApiValidationErrorFromJSONTyped(json: any, ignoreDiscriminator: boolean): ApiValidationError {
    if (json == null) {
        return json;
    }
    return {
        
        'code': json['code'],
        'type': json['type'],
        'title': json['title'],
        'message': json['message'],
        'details': json['details'] == null ? undefined : json['details'],
    };
}

  export function ApiValidationErrorToJSON(json: any): ApiValidationError {
      return ApiValidationErrorToJSONTyped(json, false);
  }

  export function ApiValidationErrorToJSONTyped(value?: ApiValidationError | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'code': value['code'],
        'type': value['type'],
        'title': value['title'],
        'message': value['message'],
        'details': value['details'],
    };
}

