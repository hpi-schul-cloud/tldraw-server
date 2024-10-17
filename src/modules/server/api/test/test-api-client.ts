import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';

const headerConst = {
	accept: 'accept',
	json: 'application/json',
};

const testReqestConst = {
	prefix: 'Bearer',
	loginPath: '/authentication/local',
	accessToken: 'accessToken',
	errorMessage: 'TestApiClient: Can not cast to local AutenticationResponse:',
};

/**
 * Note res.cookie is not supported atm, feel free to add this
 */
export class TestApiClient {
	private readonly app: INestApplication;

	private readonly baseRoute: string;

	private readonly authHeader: string;

	private readonly kindOfAuth: string;

	public constructor(app: INestApplication, baseRoute: string, authValue?: string, useAsApiKey = false) {
		this.app = app;
		this.baseRoute = this.checkAndAddPrefix(baseRoute);
		this.authHeader = useAsApiKey ? `${authValue ?? ''}` : `${testReqestConst.prefix} ${authValue ?? ''}`;
		this.kindOfAuth = useAsApiKey ? 'X-API-KEY' : 'authorization';
	}

	public get(subPath?: string): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.get(path)
			.set(this.kindOfAuth, this.authHeader)
			.set(headerConst.accept, headerConst.json);

		return testRequestInstance;
	}

	public delete(subPath?: string): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.delete(path)
			.set(this.kindOfAuth, this.authHeader)
			.set(headerConst.accept, headerConst.json);

		return testRequestInstance;
	}

	public put<T extends object | string>(subPath?: string, data?: T): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.put(path)
			.set(this.kindOfAuth, this.authHeader)
			.send(data);

		return testRequestInstance;
	}

	public patch<T extends object | string>(subPath?: string, data?: T): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.patch(path)
			.set(this.kindOfAuth, this.authHeader)
			.send(data);

		return testRequestInstance;
	}

	public post<T extends object | string>(subPath?: string, data?: T): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.post(path)
			.set(this.kindOfAuth, this.authHeader)
			.set(headerConst.accept, headerConst.json)
			.send(data);

		return testRequestInstance;
	}

	public postWithAttachment(
		subPath: string | undefined,
		fieldName: string,
		data: Buffer,
		fileName: string,
	): supertest.Test {
		const path = this.getPath(subPath);
		const testRequestInstance = supertest(this.app.getHttpServer())
			.post(path)
			.set(this.kindOfAuth, this.authHeader)
			.attach(fieldName, data, fileName);

		return testRequestInstance;
	}

	private isSlash(inputPath: string, pos: number): boolean {
		const isSlash = inputPath.charAt(pos) === '/';

		return isSlash;
	}

	private checkAndAddPrefix(inputPath = '/'): string {
		let path = '';
		if (!this.isSlash(inputPath, 0)) {
			path = '/';
		}
		path += inputPath;

		return path;
	}

	private cleanupPath(inputPath: string): string {
		let path = inputPath;
		if (this.isSlash(path, 0) && this.isSlash(path, 1)) {
			path = path.slice(1);
		}

		return path;
	}

	private getPath(routeNameInput = ''): string {
		const routeName = this.checkAndAddPrefix(routeNameInput);
		const path = this.cleanupPath(this.baseRoute + routeName);

		return path;
	}
}
