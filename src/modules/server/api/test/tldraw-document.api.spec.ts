jest.mock('@y/redis');

import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StorageService } from '../../../../infra/storage/storage.service.js';
import { RedisService } from '../../../../infra/redis/redis.service.js';
import { App } from 'uws';
import { createMock } from '@golevelup/ts-jest';
import { ServerModule } from '../../server.module.js';
import { WebsocketGateway } from '../websocket.gateway.js';

describe('Tldraw-Document Api Test', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule],
		})
			.overrideProvider(StorageService)
			.useValue(createMock<StorageService>())
			.overrideProvider(RedisService)
			.useValue(createMock<RedisService>())
			.overrideProvider('UWS')
			.useValue(createMock<typeof App>())
			.overrideProvider(WebsocketGateway)
			.useValue(createMock<WebsocketGateway>())
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('deleteByDocName', () => {
		it('true to be true', () => {
			expect(true).toBe(true);
		});
		/* describe('when no api key is provided', () => {
			it('should return 401', async () => {
				const someId = '123';

				const response = await testApiClient.get(someId);

				expect(response.status).toEqual(HttpStatus.UNAUTHORIZED);
			});
		}); */

		/* describe('when id in params is not a mongo id', () => {
			const setup = async () => {
				const { studentAccount, studentUser } = UserAndAccountTestFactory.buildStudent();

				await em.persistAndFlush([studentAccount, studentUser]);
				em.clear();

				const loggedInClient = await testApiClient.login(studentAccount);

				return { loggedInClient };
			};

			it('should return 400', async () => {
				const { loggedInClient } = await setup();

				const response = await loggedInClient.get(`id/123`);

				expect(response.status).toEqual(HttpStatus.BAD_REQUEST);
				expect(response.body).toEqual(
					expect.objectContaining({
						validationErrors: [{ errors: ['schoolId must be a mongodb id'], field: ['schoolId'] }],
					}),
				);
			});
		});

		describe('when requested school is not found', () => {
			const setup = async () => {
				const { studentAccount, studentUser } = UserAndAccountTestFactory.buildStudent();

				await em.persistAndFlush([studentAccount, studentUser]);
				em.clear();

				const loggedInClient = await testApiClient.login(studentAccount);

				return { loggedInClient };
			};

			it('should return 404', async () => {
				const { loggedInClient } = await setup();
				const someId = new ObjectId().toHexString();

				const response = await loggedInClient.get(`id/${someId}`);

				expect(response.status).toEqual(HttpStatus.NOT_FOUND);
			});
		});

		describe('when user is not in requested school', () => {
			const setup = async () => {
				const school = schoolEntityFactory.build();
				const { studentAccount, studentUser } = UserAndAccountTestFactory.buildStudent();

				await em.persistAndFlush([school, studentAccount, studentUser]);
				em.clear();

				const loggedInClient = await testApiClient.login(studentAccount);

				return { schoolId: school.id, loggedInClient };
			};

			it('should return 403', async () => {
				const { schoolId, loggedInClient } = await setup();

				const response = await loggedInClient.get(`id/${schoolId}`);

				expect(response.status).toEqual(HttpStatus.FORBIDDEN);
			});
		});

		describe('when user is in requested school', () => {
			const setup = async () => {
				const schoolYears = schoolYearFactory.withStartYear(2002).buildList(3);
				const currentYear = schoolYears[1];
				const federalState = federalStateFactory.build();
				const county = countyEmbeddableFactory.build();
				const systems = systemEntityFactory.buildList(3);
				const school = schoolEntityFactory.build({ currentYear, federalState, systems, county });
				const { studentAccount, studentUser } = UserAndAccountTestFactory.buildStudent({ school });

				await em.persistAndFlush([...schoolYears, federalState, school, studentAccount, studentUser]);
				em.clear();

				const schoolYearResponses = schoolYears.map((schoolYear) => {
					return {
						id: schoolYear.id,
						name: schoolYear.name,
						startDate: schoolYear.startDate.toISOString(),
						endDate: schoolYear.endDate.toISOString(),
					};
				});

				const expectedResponse = {
					id: school.id,
					createdAt: school.createdAt.toISOString(),
					updatedAt: school.updatedAt.toISOString(),
					name: school.name,
					federalState: {
						id: federalState.id,
						name: federalState.name,
						abbreviation: federalState.abbreviation,
						logoUrl: federalState.logoUrl,
						counties: federalState.counties?.map((item) => {
							return {
								id: item._id.toHexString(),
								name: item.name,
								countyId: item.countyId,
								antaresKey: item.antaresKey,
							};
						}),
					},
					county: {
						id: county._id.toHexString(),
						name: county.name,
						countyId: county.countyId,
						antaresKey: county.antaresKey,
					},
					inUserMigration: undefined,
					inMaintenance: false,
					isExternal: false,
					currentYear: schoolYearResponses[1],
					years: {
						schoolYears: schoolYearResponses,
						activeYear: schoolYearResponses[1],
						lastYear: schoolYearResponses[0],
						nextYear: schoolYearResponses[2],
					},
					features: [],
					systemIds: systems.map((system) => system.id),
					// TODO: The feature isTeamCreationByStudentsEnabled is set based on the config value STUDENT_TEAM_CREATION.
					// We need to discuss how to go about the config in API tests!
					instanceFeatures: ['isTeamCreationByStudentsEnabled'],
				};

				const loggedInClient = await testApiClient.login(studentAccount);

				return { schoolId: school.id, loggedInClient, expectedResponse };
			};

			it('should return school', async () => {
				const { schoolId, loggedInClient, expectedResponse } = await setup();

				const response = await loggedInClient.get(`id/${schoolId}`);

				expect(response.status).toEqual(HttpStatus.OK);
				expect(response.body).toEqual(expectedResponse);
			});
		}); */
	});
});
