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
import type { AuthorizationContextParams } from './authorization-context-params.js';
import {
    AuthorizationContextParamsFromJSON,
    AuthorizationContextParamsFromJSONTyped,
    AuthorizationContextParamsToJSON,
    AuthorizationContextParamsToJSONTyped,
} from './authorization-context-params.js';

/**
 * 
 * @export
 * @interface AuthorizationBodyParams
 */
export interface AuthorizationBodyParams {
    /**
     * 
     * @type {AuthorizationContextParams}
     * @memberof AuthorizationBodyParams
     */
    context: AuthorizationContextParams;
    /**
     * The entity or domain object the operation should be performed on.
     * @type {string}
     * @memberof AuthorizationBodyParams
     */
    referenceType: AuthorizationBodyParamsReferenceType;
    /**
     * The id of the entity/domain object of the defined referenceType.
     * @type {string}
     * @memberof AuthorizationBodyParams
     */
    referenceId: string;
}


/**
 * @export
 */
export const AuthorizationBodyParamsReferenceType = {
    USERS: 'users',
    SCHOOLS: 'schools',
    COURSES: 'courses',
    COURSEGROUPS: 'coursegroups',
    TASKS: 'tasks',
    LESSONS: 'lessons',
    TEAMS: 'teams',
    SUBMISSIONS: 'submissions',
    SCHOOL_EXTERNAL_TOOLS: 'school-external-tools',
    BOARDNODES: 'boardnodes',
    CONTEXT_EXTERNAL_TOOLS: 'context-external-tools',
    EXTERNAL_TOOLS: 'external-tools',
    INSTANCES: 'instances'
} as const;
export type AuthorizationBodyParamsReferenceType = typeof AuthorizationBodyParamsReferenceType[keyof typeof AuthorizationBodyParamsReferenceType];


/**
 * Check if a given object implements the AuthorizationBodyParams interface.
 */
export function instanceOfAuthorizationBodyParams(value: object): value is AuthorizationBodyParams {
    if (!('context' in value) || value['context'] === undefined) return false;
    if (!('referenceType' in value) || value['referenceType'] === undefined) return false;
    if (!('referenceId' in value) || value['referenceId'] === undefined) return false;
    return true;
}

export function AuthorizationBodyParamsFromJSON(json: any): AuthorizationBodyParams {
    return AuthorizationBodyParamsFromJSONTyped(json, false);
}

export function AuthorizationBodyParamsFromJSONTyped(json: any, ignoreDiscriminator: boolean): AuthorizationBodyParams {
    if (json == null) {
        return json;
    }
    return {
        
        'context': AuthorizationContextParamsFromJSON(json['context']),
        'referenceType': json['referenceType'],
        'referenceId': json['referenceId'],
    };
}

  export function AuthorizationBodyParamsToJSON(json: any): AuthorizationBodyParams {
      return AuthorizationBodyParamsToJSONTyped(json, false);
  }

  export function AuthorizationBodyParamsToJSONTyped(value?: AuthorizationBodyParams | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'context': AuthorizationContextParamsToJSON(value['context']),
        'referenceType': value['referenceType'],
        'referenceId': value['referenceId'],
    };
}

