import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpRequest } from 'uws';

@Injectable()
export class AuthorizationService {
  constructor(private configService: ConfigService) {}

  async hasPermission(req: HttpRequest) {
    const apiHost = this.configService.get<string>('API_HOST');
    const room = req.getParameter(0);
    const headerWsProtocol = req.getHeader('sec-websocket-protocol');
    const [, , token] = /(^|,)yauth-(((?!,).)*)/.exec(headerWsProtocol) ?? [
      null,
      null,
      req.getQuery('yauth'),
    ];

    if (!token) {
      throw new Error('Missing Token');
    }

    const requestOptions = this.createAuthzRequestOptions(room, token);
    const response = await fetch(
      `${apiHost}/api/v3/authorization/by-reference`,
      requestOptions,
    );

    const { userId } = await response.json();

    if (!response.ok) {
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
  };
}
