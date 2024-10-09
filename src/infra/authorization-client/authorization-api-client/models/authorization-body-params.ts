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


// May contain unused imports in some cases
// @ts-ignore
import type { AuthorizationContextParams } from './authorization-context-params';

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
    'context': AuthorizationContextParams;
    /**
     * The entity or domain object the operation should be performed on.
     * @type {string}
     * @memberof AuthorizationBodyParams
     */
    'referenceType': AuthorizationBodyParamsReferenceType;
    /**
     * The id of the entity/domain object of the defined referenceType.
     * @type {string}
     * @memberof AuthorizationBodyParams
     */
    'referenceId': string;
}

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


