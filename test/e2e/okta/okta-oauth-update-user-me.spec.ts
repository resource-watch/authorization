import nock from 'nock';
import chai from 'chai';
import type request from 'superagent';

import { OktaUser } from 'services/okta.interfaces';
import { closeTestAgent, getTestAgent } from '../utils/test-server';
import { getMockOktaUser, mockGetUserById, mockOktaUpdateUser, mockValidJWT } from './okta.mocks';
import CacheService from 'services/cache.service';
import Should = Chai.Should;
import OrganizationModel, { IOrganization } from "models/organization";
import { assertConnection, assertNoConnection, createApplication, createOrganization } from "../utils/helpers";
import ApplicationModel, { IApplication } from "models/application";
import OrganizationApplicationModel from "models/organization-application";
import { HydratedDocument } from "mongoose";
import ApplicationUserModel from "models/application-user";
import OrganizationUserModel, { ORGANIZATION_ROLES } from "models/organization-user";
import { describe } from "mocha";
import { mockValidateRequestWithApiKey, mockValidateRequestWithApiKeyAndUserToken } from "../utils/mocks";

const should: Should = chai.should();

let requester: ChaiHttp.Agent;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('[OKTA] Auth endpoints tests - Update user', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestAgent();
    });

    it('Updating my profile while not logged in should return a 401', async () => {
        mockValidateRequestWithApiKey({});
        const response: request.Response = await requester
            .patch(`/auth/user/me`)
            .set('x-api-key', 'api-key-test')
            .set('Content-Type', 'application/json');

        response.status.should.equal(401);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(401);
        response.body.errors[0].detail.should.equal('Not authenticated');
    });

    it('Updating my profile while logged in as the user should return a 200 (no actual data changes)', async () => {
        const user: OktaUser = getMockOktaUser();
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        mockGetUserById(user);
        mockOktaUpdateUser(user, {});
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const response: request.Response = await requester
            .patch(`/auth/user/me`)
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
        response.body.data.should.have.property('email').and.equal(user.profile.email);
        response.body.data.should.have.property('name').and.equal(user.profile.displayName);
        response.body.data.should.have.property('photo').and.equal(user.profile.photo);
        response.body.data.should.have.property('role').and.equal(user.profile.role);
        response.body.data.should.have.property('extraUserData').and.eql({ apps: user.profile.apps });
    });

    it('Updating my profile while logged in as the user with role USER should return a 200 with updated name and photo', async () => {
        const user: OktaUser = getMockOktaUser();
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        mockGetUserById(user);
        mockOktaUpdateUser(user, {
            displayName: 'changed name',
            photo: 'http://www.changed-photo.com',
        });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const response: request.Response = await requester
            .patch(`/auth/user/me`)
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'changed-email@example.com',
                password: 'changedPassword',
                salt: 'changedSalt',
                extraUserData: {
                    apps: ['changed-apps'],
                    foo: 'bar'
                },
                _id: 'changed-id',
                userToken: 'changedToken',
                createdAt: '2000-01-01T00:00:00.000Z',
                updatedAt: '2000-01-01T00:00:00.000Z',
                role: 'ADMIN',
                provider: 'changedProvider',
                name: 'changed name',
                photo: 'http://www.changed-photo.com'
            });

        response.status.should.equal(200);
        response.body.data.should.have.property('name').and.equal('changed name');
        response.body.data.should.have.property('photo').and.equal('http://www.changed-photo.com');
        response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
        response.body.data.should.have.property('email').and.equal(user.profile.email);
        response.body.data.should.have.property('role').and.equal(user.profile.role);
        response.body.data.should.have.property('extraUserData').and.deep.eql({ apps: user.profile.apps });
        response.body.data.should.have.property('createdAt');
        response.body.data.should.have.property('updatedAt');
    });

    it('Updating my profile while logged in as the user with role ADMIN should return a 200 with updated name, photo, role and apps', async () => {
        const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        mockGetUserById(user);
        mockOktaUpdateUser(user, {
            displayName: 'changed name',
            photo: 'http://www.changed-photo.com',
            role: 'MANAGER',
            apps: ['changed-apps'],
        });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const response: request.Response = await requester
            .patch(`/auth/user/me`)
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'changed-email@example.com',
                password: 'changedPassword',
                salt: 'changedSalt',
                extraUserData: {
                    apps: ['changed-apps'],
                    foo: 'bar'
                },
                _id: 'changed-id',
                userToken: 'changedToken',
                createdAt: '2000-01-01T00:00:00.000Z',
                updatedAt: '2000-01-01T00:00:00.000Z',
                role: 'MANAGER',
                provider: 'changedProvider',
                name: 'changed name',
                photo: 'http://www.changed-photo.com'
            });

        response.status.should.equal(200);
        response.body.data.should.have.property('name').and.equal('changed name');
        response.body.data.should.have.property('photo').and.equal('http://www.changed-photo.com');
        response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
        response.body.data.should.have.property('role').and.equal('MANAGER');
        response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
        response.body.data.should.have.property('email').and.equal(user.profile.email);
        response.body.data.should.have.property('createdAt');
        response.body.data.should.have.property('updatedAt');
    });

    it('Redis cache is cleared after a user is updated', async () => {
        const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        }, false);

        mockGetUserById(user);
        mockOktaUpdateUser(user, { displayName: 'changed name' });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        // Assert value does not exist in cache before
        const value: OktaUser = await CacheService.get(`okta-user-${user.profile.legacyId}`);
        should.not.exist(value);

        // Store it in cache
        await CacheService.set(`okta-user-${user.profile.legacyId}`, user);
        const value2: OktaUser = await CacheService.get(`okta-user-${user.profile.legacyId}`);
        should.exist(value2);

        const response: request.Response = await requester
            .patch(`/auth/user/me`)
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'changed name' });

        response.status.should.equal(200);

        // Assert value does not exist in cache after
        const value3: OktaUser = await CacheService.get(`okta-user-${user.profile.legacyId}`);
        should.not.exist(value3);
    });

    describe('with associated applications', () => {

        describe('USER role', () => {
            it('Updating my profile while being logged in as USER and associating an application that\'s associated with a different user should fail', async () => {
                const testApplication: HydratedDocument<IApplication> = await createApplication();

                const originalOwnerUser: OktaUser = getMockOktaUser();

                await new ApplicationUserModel({
                    userId: originalOwnerUser.profile.legacyId,
                    application: testApplication
                }).save();

                const user: OktaUser = getMockOktaUser({ role: 'USER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                mockGetUserById(originalOwnerUser);
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array').and.length(1);
                response.body.errors[0].should.have.property('status').and.equal(403);
                response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

                await assertConnection({ application: testApplication, user: originalOwnerUser })
                await assertNoConnection({ application: testApplication, user })
            });

            it('Updating my profile while being logged in as USER and associating an application that\'s associated with an organization I am member of should fail', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'USER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: HydratedDocument<IApplication> = await createApplication();
                const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

                await new OrganizationUserModel({
                    organization: testOrganization.id,
                    userId: user.profile.legacyId,
                    role: ORGANIZATION_ROLES.ORG_MEMBER
                }).save();
                await new OrganizationApplicationModel({
                    organization: testOrganization.id,
                    application: testApplication.id
                }).save();
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        extraUserData: {
                            foo: 'bar'
                        },
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array').and.length(1);
                response.body.errors[0].should.have.property('status').and.equal(403);
                response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

                await assertConnection({ application: testApplication, organization: testOrganization })
                await assertNoConnection({ application: testApplication, user })
            });

            it('Updating my profile while being logged in as USER and associating an application that\'s associated with an organization I am admin of should be successful', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'USER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: HydratedDocument<IApplication> = await createApplication();
                const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

                await new OrganizationUserModel({
                    organization: testOrganization.id,
                    userId: user.profile.legacyId,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();
                await new OrganizationApplicationModel({
                    organization: testOrganization.id,
                    application: testApplication.id
                }).save();

                mockGetUserById(user);
                mockOktaUpdateUser(user, {
                    displayName: 'changed name',
                    photo: 'https://www.changed-photo.com',
                });
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        extraUserData: {
                            foo: 'bar'
                        },
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(200);
                response.body.data.should.have.property('name').and.equal('changed name');
                response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
                response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['rw'] });
                response.body.data.should.have.property('role').and.equal('USER');
                response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
                response.body.data.should.have.property('email').and.equal(user.profile.email);
                response.body.data.should.have.property('applications').and.eql([{
                    id: testApplication.id,
                    name: testApplication.name,
                }]);
                response.body.data.should.have.property('createdAt');
                response.body.data.should.have.property('updatedAt');

                await assertNoConnection({
                    application: testApplication,
                    organization: testOrganization
                });
                await assertConnection({ user: user, organization: testOrganization });
                await assertConnection({ application: testApplication, user: user });
            });
        })

        describe('MANAGER role', () => {
            it('Updating my profile while being logged in as MANAGER and associating an application that\'s associated with a different user should fail', async () => {
                const testApplication: HydratedDocument<IApplication> = await createApplication();

                const originalOwnerUser: OktaUser = getMockOktaUser();

                await new ApplicationUserModel({
                    userId: originalOwnerUser.profile.legacyId,
                    application: testApplication
                }).save();

                const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                mockGetUserById(originalOwnerUser);
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array').and.length(1);
                response.body.errors[0].should.have.property('status').and.equal(403);
                response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

                await assertConnection({ application: testApplication, user: originalOwnerUser })
                await assertNoConnection({ application: testApplication, user })
            });

            it('Updating my profile while being logged in as MANAGER and associating an application that\'s associated with an organization I am member of should fail', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: HydratedDocument<IApplication> = await createApplication();
                const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

                await new OrganizationUserModel({
                    organization: testOrganization.id,
                    userId: user.profile.legacyId,
                    role: ORGANIZATION_ROLES.ORG_MEMBER
                }).save();
                await new OrganizationApplicationModel({
                    organization: testOrganization.id,
                    application: testApplication.id
                }).save();
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        extraUserData: {
                            foo: 'bar'
                        },
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array').and.length(1);
                response.body.errors[0].should.have.property('status').and.equal(403);
                response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

                await assertConnection({ application: testApplication, organization: testOrganization })
                await assertNoConnection({ application: testApplication, user })
            });

            it('Updating my profile while being logged in as MANAGER and associating an application that\'s associated with an organization I am admin of should be successful', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: HydratedDocument<IApplication> = await createApplication();
                const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

                await new OrganizationUserModel({
                    organization: testOrganization.id,
                    userId: user.profile.legacyId,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();
                await new OrganizationApplicationModel({
                    organization: testOrganization.id,
                    application: testApplication.id
                }).save();

                mockGetUserById(user);
                mockOktaUpdateUser(user, {
                    displayName: 'changed name',
                    photo: 'https://www.changed-photo.com',
                });
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        extraUserData: {
                            foo: 'bar'
                        },
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        applications: [testApplication.id],
                    });

                response.status.should.equal(200);
                response.body.data.should.have.property('name').and.equal('changed name');
                response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
                response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['rw'] });
                response.body.data.should.have.property('role').and.equal('MANAGER');
                response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
                response.body.data.should.have.property('email').and.equal(user.profile.email);
                response.body.data.should.have.property('applications').and.eql([{
                    id: testApplication.id,
                    name: testApplication.name,
                }]);
                response.body.data.should.have.property('createdAt');
                response.body.data.should.have.property('updatedAt');

                await assertNoConnection({
                    application: testApplication,
                    organization: testOrganization
                });
                await assertConnection({ user: user, organization: testOrganization });
                await assertConnection({ application: testApplication, user: user });
            });
        })

        it('Updating my profile while being logged in as USER and associating an application that\'s associated with a different user with the current user should fail', async () => {
            const testApplication: HydratedDocument<IApplication> = await createApplication();

            const originalOwnerUser: OktaUser = getMockOktaUser();

            await new ApplicationUserModel({
                userId: originalOwnerUser.profile.legacyId,
                application: testApplication
            }).save();

            const user: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(originalOwnerUser);
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    applications: [testApplication.id],
                });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array');
            response.body.errors[0].status.should.equal(403);
            response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

            await assertNoConnection({ application: testApplication, user: user })
            await assertConnection({ application: testApplication, user: originalOwnerUser })
        });

        it('Updating my profile while being logged in as MANAGER and associating an application that\'s associated with a different user with the current user should fail', async () => {
            const testApplication: HydratedDocument<IApplication> = await createApplication();

            const originalOwnerUser: OktaUser = getMockOktaUser();

            await new ApplicationUserModel({
                userId: originalOwnerUser.profile.legacyId,
                application: testApplication
            }).save();

            const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(originalOwnerUser);
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    applications: [testApplication.id],
                });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array');
            response.body.errors[0].status.should.equal(403);
            response.body.errors[0].detail.should.equal(`You don't have permissions to associate application ${testApplication.id} with user ${user.profile.legacyId}`);

            await assertNoConnection({ application: testApplication, user: user })
            await assertConnection({ application: testApplication, user: originalOwnerUser })
        });

        it('Updating my profile while being logged in as ADMIN and associating an application that\'s associated with a different user with the current user should be successful', async () => {
            const testApplication: HydratedDocument<IApplication> = await createApplication();

            const originalOwnerUser: OktaUser = getMockOktaUser();

            await new ApplicationUserModel({
                userId: originalOwnerUser.profile.legacyId,
                application: testApplication
            }).save();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    applications: [testApplication.id],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertConnection({ application: testApplication, user: user })
            await assertNoConnection({ application: testApplication, user: originalOwnerUser })
        });

        it('Updating my profile and associating an application that\'s associated with an organization user should be successful and remove association with organization', async () => {
            const testApplication: IApplication = await createApplication();
            const testOrganization: IOrganization = await createOrganization();

            const originalOwnerUser: OktaUser = getMockOktaUser();

            await new OrganizationApplicationModel({
                userId: originalOwnerUser.id,
                organization: testOrganization
            }).save();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    applications: [testApplication.id],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertConnection({ application: testApplication, user: user })
            await assertNoConnection({ organization: testOrganization, user: originalOwnerUser })
        });

        it('Updating my profile and overwriting existing applications should be successful', async () => {
            const testApplicationOne: HydratedDocument<IApplication> = await createApplication();
            const testApplicationTwo: HydratedDocument<IApplication> = await createApplication();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            await new ApplicationUserModel({ userId: user.profile.legacyId, application: testApplicationOne }).save();

            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    applications: [testApplicationTwo.id],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('applications').and.eql([{
                id: testApplicationTwo.id,
                name: testApplicationTwo.name,
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertNoConnection({ application: testApplicationOne, user: user })
            await assertConnection({ application: testApplicationTwo, user: user })
        });

        it('Updating my profile and removing applications should be successful', async () => {
            const testApplication: HydratedDocument<IApplication> = await createApplication();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            await new ApplicationUserModel({ userId: user.id, application: testApplication }).save();

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    applications: [],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('applications').and.eql([]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertNoConnection({ application: testApplication, user: null });
        });
    })

    describe('with associated organizations', () => {
        describe('USER role', () => {
            it('Updating my profile while being logged in as USER and associating an organization with my user should fail', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'USER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: IApplication = await createApplication();
                const testOrganization: IOrganization = await createOrganization();

                await new OrganizationApplicationModel({
                    application: testApplication,
                    organization: testOrganization
                }).save();
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        organizations: [{
                            id: testOrganization.id,
                            role: ORGANIZATION_ROLES.ORG_MEMBER
                        }],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array');
                response.body.errors[0].status.should.equal(403);
                response.body.errors[0].detail.should.equal('You don\'t have permissions to change your permissions with this/these organization(s)');

                await assertConnection({ organization: testOrganization, application: testApplication });
                await assertNoConnection({ user: user, application: testApplication });
                await assertNoConnection({ organization: testOrganization, user: user });
            });

            it('Updating my profile while being logged in as USER and removing/downgrading an organization with my user should succeed', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'USER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testOrganizationOne: IOrganization = await createOrganization();
                const testOrganizationTwo: IOrganization = await createOrganization();

                await new OrganizationUserModel({
                    userId: user.profile.legacyId,
                    organization: testOrganizationOne,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();
                await new OrganizationUserModel({
                    userId: user.profile.legacyId,
                    organization: testOrganizationTwo,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();

                mockGetUserById(user);
                mockOktaUpdateUser(user, {
                    displayName: 'changed name',
                    photo: 'https://www.changed-photo.com',
                });
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        organizations: [{
                            id: testOrganizationTwo.id,
                            role: 'ORG_MEMBER'
                        }],
                    });

                response.status.should.equal(200);
                response.body.data.should.have.property('name').and.equal('changed name');
                response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
                response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
                response.body.data.should.have.property('email').and.equal(user.profile.email);
                response.body.data.should.have.property('organizations').and.eql([{
                    id: testOrganizationTwo.id,
                    name: testOrganizationTwo.name,
                    role: 'ORG_MEMBER'
                }]);
                response.body.data.should.have.property('createdAt');
                response.body.data.should.have.property('updatedAt');

                await assertNoConnection({ organization: testOrganizationOne, user: user });
                await assertConnection({
                    organization: testOrganizationTwo,
                    user: user,
                    role: ORGANIZATION_ROLES.ORG_MEMBER
                });
            });
        })

        describe('MANAGER role', () => {
            it('Updating my profile while being logged in as MANAGER and associating an organization with my user should fail', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testApplication: IApplication = await createApplication();
                const testOrganization: IOrganization = await createOrganization();

                await new OrganizationApplicationModel({
                    application: testApplication,
                    organization: testOrganization
                }).save();
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        organizations: [{
                            id: testOrganization.id,
                            role: ORGANIZATION_ROLES.ORG_MEMBER
                        }],
                    });

                response.status.should.equal(403);
                response.body.should.have.property('errors').and.be.an('array');
                response.body.errors[0].status.should.equal(403);
                response.body.errors[0].detail.should.equal('You don\'t have permissions to change your permissions with this/these organization(s)');

                await assertConnection({ organization: testOrganization, application: testApplication });
                await assertNoConnection({ user: user, application: testApplication });
                await assertNoConnection({ organization: testOrganization, user: user });
            });

            it('Updating my profile while being logged in as MANAGER and removing/downgrading an organization with my user should succeed', async () => {
                const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
                const token: string = mockValidJWT({
                    id: user.profile.legacyId,
                    email: user.profile.email,
                    role: user.profile.role,
                    extraUserData: { apps: user.profile.apps },
                });

                const testOrganizationOne: IOrganization = await createOrganization();
                const testOrganizationTwo: IOrganization = await createOrganization();

                await new OrganizationUserModel({
                    userId: user.profile.legacyId,
                    organization: testOrganizationOne,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();
                await new OrganizationUserModel({
                    userId: user.profile.legacyId,
                    organization: testOrganizationTwo,
                    role: ORGANIZATION_ROLES.ORG_ADMIN
                }).save();

                mockGetUserById(user);
                mockOktaUpdateUser(user, {
                    displayName: 'changed name',
                    photo: 'https://www.changed-photo.com',
                });
                mockValidateRequestWithApiKeyAndUserToken({ token });

                const response: request.Response = await requester
                    .patch(`/auth/user/me`)
                    .set('Content-Type', 'application/json')
                    .set('x-api-key', 'api-key-test')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        email: 'changed-email@example.com',
                        password: 'changedPassword',
                        salt: 'changedSalt',
                        _id: 'changed-id',
                        userToken: 'changedToken',
                        createdAt: '2000-01-01T00:00:00.000Z',
                        updatedAt: '2000-01-01T00:00:00.000Z',
                        provider: 'changedProvider',
                        name: 'changed name',
                        photo: 'https://www.changed-photo.com',
                        organizations: [{
                            id: testOrganizationTwo.id,
                            role: ORGANIZATION_ROLES.ORG_MEMBER
                        }],
                    });

                response.status.should.equal(200);
                response.body.data.should.have.property('name').and.equal('changed name');
                response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
                response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
                response.body.data.should.have.property('email').and.equal(user.profile.email);
                response.body.data.should.have.property('organizations').and.eql([{
                    id: testOrganizationTwo.id,
                    name: testOrganizationTwo.name,
                    role: 'ORG_MEMBER'
                }]);
                response.body.data.should.have.property('createdAt');
                response.body.data.should.have.property('updatedAt');

                await assertNoConnection({ organization: testOrganizationOne, user: user });
                await assertConnection({
                    organization: testOrganizationTwo,
                    user: user,
                    role: ORGANIZATION_ROLES.ORG_MEMBER
                });
            });
        })

        it('Updating my profile and associating an organization as ORG_ADMIN should fail', async () => {
            const userToBeUpdated: OktaUser = getMockOktaUser();
            const token: string = mockValidJWT({ role: 'ADMIN' });

            const testApplication: IApplication = await createApplication();
            const testOrganization: IOrganization = await createOrganization();

            await new OrganizationApplicationModel({
                application: testApplication,
                organization: testOrganization
            }).save();
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [{
                        id: testOrganization.id,
                        role: ORGANIZATION_ROLES.ORG_ADMIN
                    }],
                });

            response.status.should.equal(400);
            response.body.should.have.property('errors').and.be.an('array');
            response.body.errors[0].status.should.equal(400);
            response.body.errors[0].detail.should.equal('"organizations[0].role" must be [ORG_MEMBER]');

            await assertConnection({ organization: testOrganization, application: testApplication });
            await assertNoConnection({ user: userToBeUpdated, organization: testOrganization });
        });

        it('Updating my profile while being logged in as ADMIN and associating an organization with my user user should be successful', async () => {
            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            const testApplication: IApplication = await createApplication();
            const testOrganization: IOrganization = await createOrganization();

            await new OrganizationApplicationModel({
                application: testApplication,
                organization: testOrganization
            }).save();

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps']
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [{
                        id: testOrganization.id,
                        role: ORGANIZATION_ROLES.ORG_MEMBER
                    }],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('organizations').and.eql([{
                id: testOrganization.id,
                name: testOrganization.name,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertNoConnection({ user: user, application: testApplication });
            await assertConnection({ organization: testOrganization, application: testApplication });
            await assertConnection({ organization: testOrganization, user: user, role: ORGANIZATION_ROLES.ORG_MEMBER });
        });

        it('Updating my profile and associating an organization that\'s associated with a different user with the current user should be successful not remove previous user association', async () => {
            const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

            const originalUser: OktaUser = getMockOktaUser();

            await new OrganizationUserModel({
                userId: originalUser.profile.legacyId,
                organization: testOrganization,
                role: ORGANIZATION_ROLES.ORG_ADMIN
            }).save();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [{ id: testOrganization.id, role: ORGANIZATION_ROLES.ORG_MEMBER }],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('organizations').and.eql([{
                id: testOrganization.id,
                name: testOrganization.name,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertConnection({ organization: testOrganization, user: user, role: ORGANIZATION_ROLES.ORG_MEMBER })
            await assertConnection({ organization: testOrganization, user: originalUser })
        });

        it('Updating my profile and associating an organization that\'s associated with an application user should be successful and remove association with application', async () => {
            const testOrganization: IOrganization = await createOrganization();
            const testOrganizationApplication: IApplication = await createApplication();
            const testUserApplication: IApplication = await createApplication();

            const originalOwnerUser: OktaUser = getMockOktaUser();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            await new OrganizationApplicationModel({
                organization: testOrganization,
                application: testOrganizationApplication
            }).save();

            await new ApplicationUserModel({
                userId: user.profile.legacyId,
                application: testUserApplication
            }).save();

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [{ id: testOrganization.id, role: ORGANIZATION_ROLES.ORG_MEMBER }],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('organizations').and.eql([{
                id: testOrganization.id,
                name: testOrganization.name,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertConnection({ organization: testOrganization, user: user })
            await assertConnection({ application: testUserApplication, user: user })
            await assertNoConnection({ application: testOrganizationApplication, user: originalOwnerUser })
        });

        it('Updating my profile and overwriting existing organizations should be successful', async () => {
            const testOrganizationOne: HydratedDocument<IOrganization> = await createOrganization();
            const testOrganizationTwo: HydratedDocument<IOrganization> = await createOrganization();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            await new OrganizationUserModel({
                userId: user.id,
                organization: testOrganizationOne,
                role: 'ADMIN'
            }).save();

            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [{ id: testOrganizationTwo.id, role: ORGANIZATION_ROLES.ORG_MEMBER }],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('organizations').and.eql([{
                id: testOrganizationTwo.id,
                name: testOrganizationTwo.name,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertNoConnection({ organization: testOrganizationOne, user: user })
            await assertConnection({ organization: testOrganizationTwo, user: user })
        });

        it('Updating my profile and removing organizations should be successful', async () => {
            const testOrganization: HydratedDocument<IOrganization> = await createOrganization();

            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            await new OrganizationUserModel({
                userId: user.id,
                organization: testOrganization,
                role: 'ADMIN'
            }).save();

            mockGetUserById(user);
            mockOktaUpdateUser(user, {
                displayName: 'changed name',
                photo: 'https://www.changed-photo.com',
                role: 'MANAGER',
                apps: ['changed-apps'],
            });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .patch(`/auth/user/me`)
                .set('Content-Type', 'application/json')
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    email: 'changed-email@example.com',
                    password: 'changedPassword',
                    salt: 'changedSalt',
                    extraUserData: {
                        apps: ['changed-apps'],
                        foo: 'bar'
                    },
                    _id: 'changed-id',
                    userToken: 'changedToken',
                    createdAt: '2000-01-01T00:00:00.000Z',
                    updatedAt: '2000-01-01T00:00:00.000Z',
                    role: 'MANAGER',
                    provider: 'changedProvider',
                    name: 'changed name',
                    photo: 'https://www.changed-photo.com',
                    organizations: [],
                });

            response.status.should.equal(200);
            response.body.data.should.have.property('name').and.equal('changed name');
            response.body.data.should.have.property('photo').and.equal('https://www.changed-photo.com');
            response.body.data.should.have.property('extraUserData').and.be.an('object').and.deep.eql({ apps: ['changed-apps'] });
            response.body.data.should.have.property('role').and.equal('MANAGER');
            response.body.data.should.have.property('id').and.equal(user.profile.legacyId);
            response.body.data.should.have.property('email').and.equal(user.profile.email);
            response.body.data.should.have.property('organizations').and.eql([]);
            response.body.data.should.have.property('createdAt');
            response.body.data.should.have.property('updatedAt');

            await assertNoConnection({ organization: testOrganization, user: null });
        });
    })

    after(async () => {
        await closeTestAgent();
    });

    afterEach(async () => {
        await ApplicationModel.deleteMany({}).exec();
        await OrganizationModel.deleteMany({}).exec();
        await OrganizationApplicationModel.deleteMany({}).exec();
        await OrganizationUserModel.deleteMany({}).exec();
        await ApplicationUserModel.deleteMany({}).exec();

        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });
});
