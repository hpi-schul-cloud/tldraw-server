import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpRequest } from 'uws';

@Injectable()
export class AuthorizationService {
	constructor(private configService: ConfigService) {}

	async hasPermission(req: HttpRequest) {
		const apiHost = this.configService.get<string>('API_HOST');
		const room = req.getParameter(0);
		const token = this.getCookie(req, 'jwt');

		if (!token) {
			throw new Error('Missing Token');
		}

		const requestOptions = this.createAuthzRequestOptions(room, token);
		const response = await fetch(`${apiHost}/api/v3/authorization/by-reference`, requestOptions);

		if (!response.ok) {
			throw new Error('Authorization failed');
		}

		const { isAuthorized, userId } = await response.json();

		if (!isAuthorized) {
			throw new Error('Authorization failed');
		}

		const result = { hasWriteAccess: true, room, userid: userId };

		return result;
	}

	private createAuthzRequestOptions(room: string, token: string) {
		const requestOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + token,
			},
			body: JSON.stringify({
				context: {
					action: 'read',
					requiredPermissions: ['COURSE_EDIT'],
				},
				referenceType: 'boardnodes',
				referenceId: room,
			}),
		};

		return requestOptions;
	}

	private getCookie(request: HttpRequest, cookieName: string) {
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
