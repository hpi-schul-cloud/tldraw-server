import { Injectable } from '@nestjs/common';
import { RawAxiosRequestConfig } from 'axios';
import { HttpRequest } from 'uws';
import { Logger } from '../logging/logger.js';
import { AuthorizationApi } from './authorization-api-client/api/authorization-api.js';
import { Action } from './authorization-api-client/models/action.js';
import {
	AuthorizationBodyParams,
	AuthorizationBodyParamsReferenceType,
} from './authorization-api-client/models/authorization-body-params.js';
import { ResponsePayload } from './interfaces/response.payload.js';
import { ResponsePayloadBuilder } from './response.builder.js';

@Injectable()
export class AuthorizationService {
	public constructor(
		private readonly authorizationApi: AuthorizationApi,
		private logger: Logger,
	) {
		logger.setContext(AuthorizationService.name);
	}

	public async hasPermission(req: HttpRequest): Promise<ResponsePayload> {
		let response: ResponsePayload;
		try {
			const room = this.getRoom(req);
			const token = this.getToken(req);

			response = await this.fetchAuthorization(room, token);
		} catch (error) {
			response = this.createErrorResponsePayload(4500, error.message);
		}

		return response;
	}

	private getRoom(req: HttpRequest): string {
		const room = req.getParameter(0);

		if (!room) {
			throw new Error('RoomId not found');
		}

		return room;
	}

	private getToken(req: HttpRequest): string {
		const jwtToken = this.getCookie(req, 'jwt');

		if (!jwtToken) {
			throw new Error('JWT token not found');
		}

		return jwtToken;
	}

	private async fetchAuthorization(room: string, token: string): Promise<ResponsePayload> {
		const params: AuthorizationBodyParams = {
			referenceType: AuthorizationBodyParamsReferenceType.BOARDNODES,
			referenceId: room,
			context: {
				action: Action.READ,
				requiredPermissions: ['COURSE_VIEW'],
			},
		};

		const options: RawAxiosRequestConfig<any> = { headers: { authorization: `Bearer ${token}` } };

		const response = await this.authorizationApi.authorizationReferenceControllerAuthorizeByReference(params, options);

		const { isAuthorized, userId } = response.data;
		if (!isAuthorized) {
			return this.createErrorResponsePayload(4401, 'Unauthorized');
		}

		return this.createResponsePayload(room, userId);
	}

	private createResponsePayload(room: string, userId: string): ResponsePayload {
		const response = ResponsePayloadBuilder.build(room, userId, null, true);

		return response;
	}

	private createErrorResponsePayload(code: number, reason: string): ResponsePayload {
		const response = ResponsePayloadBuilder.buildWithError(code, reason);
		this.logger.error(`Error: ${code} - ${reason}`);

		return response;
	}

	private getCookie(request: HttpRequest, cookieName: string): string | null {
		const cookie = request.getHeader('cookie');
		if (!cookie) {
			return null;
		}
		const cookieValue = cookie.split(';').find((c) => c.trim().startsWith(`${cookieName}=`));
		if (!cookieValue) {
			return null;
		}

		return cookieValue.split('=')[1];
	}
}
