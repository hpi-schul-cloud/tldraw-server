import { Injectable } from '@nestjs/common';
import { HttpRequest } from 'uWebSockets.js';
import { Logger } from '../logger/index.js';
import {
	AuthorizationApi,
	AuthorizationBodyParamsReferenceType,
	AuthorizationContextParamsAction,
	AuthorizationContextParamsRequiredPermissions,
	AuthorizationReferenceControllerAuthorizeByReferenceRequest,
} from './authorization-api-client/index.js';
import { ResponsePayload } from './interfaces/response.payload.js';
import { ResponsePayloadBuilder } from './response.builder.js';

@Injectable()
export class AuthorizationService {
	public constructor(
		private readonly authorizationApi: AuthorizationApi,
		private readonly logger: Logger,
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
			if (error.message === 'JWT not found') {
				response = this.createErrorResponsePayload(4401, 'JWT not found');
			} else {
				response = this.createErrorResponsePayload(4500, error.message);
			}
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
		const token = this.getCookie(req, 'jwt');

		if (!token) {
			throw new Error('JWT not found');
		}

		return token;
	}

	private async fetchAuthorization(room: string, token: string): Promise<ResponsePayload> {
		const requestParameters: AuthorizationReferenceControllerAuthorizeByReferenceRequest = {
			authorizationBodyParams: {
				referenceType: AuthorizationBodyParamsReferenceType.BOARDNODES,
				referenceId: room,
				context: {
					action: AuthorizationContextParamsAction.READ,
					requiredPermissions: [AuthorizationContextParamsRequiredPermissions.COURSE_VIEW],
				},
			},
		};

		const initOverrides: RequestInit = {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
		};

		const response = await this.authorizationApi.authorizationReferenceControllerAuthorizeByReference(
			requestParameters,
			initOverrides,
		);

		const { isAuthorized, userId } = response;
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
