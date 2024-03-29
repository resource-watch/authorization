import nock from 'nock';
import chai from 'chai';
import config from 'config';
import OrganizationModel, { IOrganization } from 'models/organization';
import { getTestAgent } from '../utils/test-server';
import { assertConnection, createApplication, createOrganization } from '../utils/helpers';
import chaiDateTime from 'chai-datetime';
import request from 'superagent';
import { HydratedDocument } from 'mongoose';
import { getMockOktaUser, mockGetUserById, mockValidJWT } from '../okta/okta.mocks';
import { describe } from 'mocha';
import ApplicationModel, { IApplication } from "models/application";
import OrganizationApplicationModel from "models/organization-application";
import OrganizationUserModel, { ORGANIZATION_ROLES } from "models/organization-user";
import ApplicationUserModel from "models/application-user";
import { OktaUser } from "services/okta.interfaces";
import { mockValidateRequestWithApiKey, mockValidateRequestWithApiKeyAndUserToken } from "../utils/mocks";

chai.should();
chai.use(chaiDateTime);

let requester: ChaiHttp.Agent;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Get organizations tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestAgent();
    });

    beforeEach(async () => {
        await OrganizationModel.deleteMany({}).exec();
    });

    it('Get organizations while not being logged in should return a 401 error', async () => {
        mockValidateRequestWithApiKey({});
        const response: request.Response = await requester
            .get(`/api/v1/organization`)
            .set('x-api-key', 'api-key-test');

        response.status.should.equal(401);
        response.body.should.have.property('errors').and.be.an('array').and.length(1);
        response.body.errors[0].should.have.property('status').and.equal(401);
        response.body.errors[0].should.have.property('detail').and.equal('Not authenticated');
    });

    it('Get organizations while being logged in as USER should return a 200 and organizations for the current user', async () => {
        const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
        const token: string = mockValidJWT({
            id: testUser.profile.legacyId,
            email: testUser.profile.email,
            role: testUser.profile.role,
            extraUserData: { apps: testUser.profile.apps },
        });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const testUserOrganization: HydratedDocument<IOrganization> = await createOrganization();
        await createOrganization();
        mockGetUserById(testUser);

        await new OrganizationUserModel({
            organization: testUserOrganization,
            userId: testUser.profile.legacyId,
            role: ORGANIZATION_ROLES.ORG_MEMBER
        }).save();

        const response: request.Response = await requester
            .get(`/api/v1/organization`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.length(1);
        response.body.data[0].should.have.property('type').and.equal('organizations');
        response.body.data[0].should.have.property('id').and.equal(testUserOrganization._id.toString());
        response.body.data[0].should.have.property('attributes').and.be.an('object');
        response.body.data[0].attributes.should.have.property('name').and.equal(testUserOrganization.name);
        response.body.data[0].attributes.should.have.property('applications').and.eql([]);
        response.body.data[0].attributes.should.have.property('createdAt');
        new Date(response.body.data[0].attributes.createdAt).should.equalDate(testUserOrganization.createdAt);
        response.body.data[0].attributes.should.have.property('updatedAt');
        new Date(response.body.data[0].attributes.updatedAt).should.equalDate(testUserOrganization.updatedAt);
    });

    it('Get organizations while being logged in as MANAGER should return a 200 and the list of all organizations (happy case)', async () => {
        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const token: string = mockValidJWT({ role: 'MANAGER' });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const response: request.Response = await requester
            .get(`/api/v1/organization`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.length(1);
        response.body.data[0].should.have.property('type').and.equal('organizations');
        response.body.data[0].should.have.property('id').and.equal(organization._id.toString());
        response.body.data[0].should.have.property('attributes').and.be.an('object');
        response.body.data[0].attributes.should.have.property('name').and.equal(organization.name);
        response.body.data[0].attributes.should.have.property('applications').and.eql([]);
        response.body.data[0].attributes.should.have.property('createdAt');
        new Date(response.body.data[0].attributes.createdAt).should.equalDate(organization.createdAt);
        response.body.data[0].attributes.should.have.property('updatedAt');
        new Date(response.body.data[0].attributes.updatedAt).should.equalDate(organization.updatedAt);
    });

    it('Get organizations while being logged in should return a 200 and the list of all organizations (happy case)', async () => {
        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const token: string = mockValidJWT({ role: 'ADMIN' });
        mockValidateRequestWithApiKeyAndUserToken({ token });

        const response: request.Response = await requester
            .get(`/api/v1/organization`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.length(1);
        response.body.data[0].should.have.property('type').and.equal('organizations');
        response.body.data[0].should.have.property('id').and.equal(organization._id.toString());
        response.body.data[0].should.have.property('attributes').and.be.an('object');
        response.body.data[0].attributes.should.have.property('name').and.equal(organization.name);
        response.body.data[0].attributes.should.have.property('applications').and.eql([]);
        response.body.data[0].attributes.should.have.property('createdAt');
        new Date(response.body.data[0].attributes.createdAt).should.equalDate(organization.createdAt);
        response.body.data[0].attributes.should.have.property('updatedAt');
        new Date(response.body.data[0].attributes.updatedAt).should.equalDate(organization.updatedAt);
    });

    describe('Pagination', () => {
        it('Get paginated organizations should return a 200 and the paginated organization data - Different pages, USER role', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });
            const otherUser: OktaUser = getMockOktaUser({ role: 'USER' });

            for (let i: number = 0; i < 25; i++) {
                const organization: IOrganization = await createOrganization();

                await new OrganizationUserModel({
                    userId: (i % 2 == 0 ? testUser.profile.legacyId : otherUser.profile.legacyId),
                    organization: organization._id.toString(),
                    role: ORGANIZATION_ROLES.ORG_MEMBER
                }).save();
            }

            mockGetUserById(testUser, 13);
            mockValidateRequestWithApiKeyAndUserToken({ token });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const responsePageOne: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 1 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageOne.status.should.equal(200);
            responsePageOne.body.should.have.property('data').and.be.an('array').and.length(10);
            responsePageOne.body.should.have.property('links').and.be.an('object');
            responsePageOne.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageOne.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);

            const responsePageTwo: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 2 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageTwo.status.should.equal(200);
            responsePageTwo.body.should.have.property('data').and.be.an('array').and.length(3);
            responsePageTwo.body.should.have.property('links').and.be.an('object');
            responsePageTwo.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageTwo.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageTwo.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
        });

        it('Get paginated organizations should return a 200 and the paginated organization data - Different pages, MANAGER role', async () => {
            const organizations: HydratedDocument<IOrganization>[] = [];
            for (let i: number = 0; i < 25; i++) {
                organizations.push(await createOrganization());
            }

            const token: string = mockValidJWT({ role: 'MANAGER' });
            mockValidateRequestWithApiKeyAndUserToken({ token });
            mockValidateRequestWithApiKeyAndUserToken({ token });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const responsePageOne: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 1 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageOne.status.should.equal(200);
            responsePageOne.body.should.have.property('data').and.be.an('array').and.length(10);
            responsePageOne.body.should.have.property('links').and.be.an('object');
            responsePageOne.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageOne.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);

            const responsePageTwo: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 2 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageTwo.status.should.equal(200);
            responsePageTwo.body.should.have.property('data').and.be.an('array').and.length(10);
            responsePageTwo.body.should.have.property('links').and.be.an('object');
            responsePageTwo.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageTwo.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageTwo.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);

            const responsePageThree: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 3 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageThree.status.should.equal(200);
            responsePageThree.body.should.have.property('data').and.be.an('array').and.length(5);
            responsePageThree.body.should.have.property('links').and.be.an('object');
            responsePageThree.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageThree.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageThree.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageThree.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageThree.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
        });

        it('Get paginated organizations should return a 200 and the paginated organization data - Different pages, ADMIN role', async () => {
            const organizations: HydratedDocument<IOrganization>[] = [];
            for (let i: number = 0; i < 25; i++) {
                organizations.push(await createOrganization());
            }

            const token: string = mockValidJWT({ role: 'ADMIN' });
            mockValidateRequestWithApiKeyAndUserToken({ token });
            mockValidateRequestWithApiKeyAndUserToken({ token });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const responsePageOne: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 1 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageOne.status.should.equal(200);
            responsePageOne.body.should.have.property('data').and.be.an('array').and.length(10);
            responsePageOne.body.should.have.property('links').and.be.an('object');
            responsePageOne.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageOne.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageOne.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);

            const responsePageTwo: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 2 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageTwo.status.should.equal(200);
            responsePageTwo.body.should.have.property('data').and.be.an('array').and.length(10);
            responsePageTwo.body.should.have.property('links').and.be.an('object');
            responsePageTwo.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageTwo.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageTwo.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageTwo.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);

            const responsePageThree: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 10, 'page[number]': 3 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            responsePageThree.status.should.equal(200);
            responsePageThree.body.should.have.property('data').and.be.an('array').and.length(5);
            responsePageThree.body.should.have.property('links').and.be.an('object');
            responsePageThree.body.links.should.have.property('self').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageThree.body.links.should.have.property('prev').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=2&page[size]=10`);
            responsePageThree.body.links.should.have.property('next').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
            responsePageThree.body.links.should.have.property('first').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=1&page[size]=10`);
            responsePageThree.body.links.should.have.property('last').and.equal(`http://127.0.0.1:${config.get('server.port')}/v1/organization?page[number]=3&page[size]=10`);
        });

        it('Get paginated organizations with over 100 results per page should return a 400', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .get(`/api/v1/organization`)
                .query({ 'page[size]': 101 })
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            response.status.should.equal(400);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(400);
            response.body.errors[0].should.have.property('detail').and.equal('"page.size" must be less than or equal to 100');
        });
    });

    describe('with associated applications', () => {
        it('Get organizations with associated applications should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplication: IApplication = await createApplication();
            const testOrganization: IOrganization = await createOrganization();

            await new OrganizationApplicationModel({
                organization: testOrganization,
                application: testApplication
            }).save();
            mockValidateRequestWithApiKeyAndUserToken({ token });

            const response: request.Response = await requester
                .get(`/api/v1/organization`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            response.status.should.equal(200);
            response.body.should.have.property('data').and.be.an('array').and.length(1);
            response.body.data[0].should.have.property('type').and.equal('organizations');
            response.body.data[0].should.have.property('id').and.equal(testOrganization._id.toString());
            response.body.data[0].should.have.property('attributes').and.be.an('object');
            response.body.data[0].attributes.should.have.property('name').and.equal(testOrganization.name);
            response.body.data[0].attributes.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name,
            }]);
            response.body.data[0].attributes.should.have.property('createdAt');
            new Date(response.body.data[0].attributes.createdAt).should.equalDate(testOrganization.createdAt);
            response.body.data[0].attributes.should.have.property('updatedAt');
            new Date(response.body.data[0].attributes.updatedAt).should.equalDate(testOrganization.updatedAt);

            await assertConnection({ organization: testOrganization, application: testApplication });
        });
    })

    describe('with associated users', () => {
        it('Get organizations with associated users should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const testOrganization: IOrganization = await createOrganization();

            mockGetUserById(testUser);
            mockValidateRequestWithApiKeyAndUserToken({ token });

            await new OrganizationUserModel({
                organization: testOrganization,
                userId: testUser.profile.legacyId,
                role: 'ADMIN'
            }).save();

            const response: request.Response = await requester
                .get(`/api/v1/organization`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`);

            response.status.should.equal(200);
            response.body.should.have.property('data').and.be.an('array').and.length(1);
            response.body.data[0].should.have.property('type').and.equal('organizations');
            response.body.data[0].should.have.property('id').and.equal(testOrganization._id.toString());
            response.body.data[0].should.have.property('attributes').and.be.an('object');
            response.body.data[0].attributes.should.have.property('name').and.equal(testOrganization.name);
            response.body.data[0].attributes.should.have.property('users').and.eql([{
                id: testUser.profile.legacyId,
                name: testUser.profile.displayName,
                role: 'ADMIN'
            }]);
            response.body.data[0].attributes.should.have.property('createdAt');
            new Date(response.body.data[0].attributes.createdAt).should.equalDate(testOrganization.createdAt);
            response.body.data[0].attributes.should.have.property('updatedAt');
            new Date(response.body.data[0].attributes.updatedAt).should.equalDate(testOrganization.updatedAt);

            await assertConnection({ organization: testOrganization, userId: testUser.profile.legacyId });
        });
    })

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
