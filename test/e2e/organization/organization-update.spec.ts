import nock from 'nock';
import chai from 'chai';
import OrganizationModel, { IOrganization } from 'models/organization';
import chaiDateTime from 'chai-datetime';
import { getTestAgent } from '../utils/test-server';
import {
    assertConnection,
    assertNoConnection,
    createApplication,
    createOrganization,
    sortByNestedName
} from '../utils/helpers';
import request from 'superagent';
import { getMockOktaUser, mockGetUserById, mockValidJWT } from '../okta/okta.mocks';
import mongoose, { HydratedDocument } from 'mongoose';
import ApplicationModel, { IApplication } from "models/application";
import OrganizationApplicationModel from "models/organization-application";
import OrganizationUserModel, { ORGANIZATION_ROLES } from "models/organization-user";
import ApplicationUserModel from "models/application-user";
import { OktaUser } from "services/okta.interfaces";
import { describe } from "mocha";

chai.should();
chai.use(chaiDateTime);

let requester: ChaiHttp.Agent;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Update organization tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestAgent();
    });

    beforeEach(async () => {
        await OrganizationModel.deleteMany({}).exec();
    });

    it('Update a organization while not being logged in should return a 401 \'Unauthorized\' error', async () => {
        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${organization._id.toString()}`)
            .set('x-api-key', 'api-key-test')
            .send({});

        response.status.should.equal(401);
        response.body.should.have.property('errors').and.be.an('array').and.length(1);
        response.body.errors[0].should.have.property('status').and.equal(401);
        response.body.errors[0].should.have.property('detail').and.equal('Not authenticated');
    });

    describe('USER role', () => {
        it('Update a organization while being logged in as USER should return a 403 \'Not authorized\' error', async () => {
            const token: string = mockValidJWT({ role: 'USER' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');
        });

        it('Update a organization while being logged in as USER that is a member of the organization should return a 403 \'Not authorized\' error', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'new organization name' });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');
        });

        it('Update a organization while being logged in as USER that is owner of the organization should return a 200 and updated data', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_ADMIN
            }).save();

            mockGetUserById(testUser);

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'new organization name' });

            response.status.should.equal(200);
            response.body.should.have.property('data').and.be.an('object');

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(organization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal('new organization name');
            response.body.data.attributes.should.have.property('applications').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(organization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(organization.updatedAt);
        });
    })

    describe('MANAGER role', () => {
        it('Update a organization while being logged in as MANAGER should return a 403 \'Not authorized\' error', async () => {
            const token: string = mockValidJWT({ role: 'MANAGER' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');
        });

        it('Update a organization while being logged in as MANAGER that is a member of the organization should return a 403 \'Not authorized\' error', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'MANAGER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'new organization name' });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');
        });

        it('Update a organization while being logged in as MANAGER that is owner of the organization should return a 200 and updated data', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'MANAGER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_ADMIN
            }).save();

            mockGetUserById(testUser);

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'new organization name' });

            response.status.should.equal(200);
            response.body.should.have.property('data').and.be.an('object');

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(organization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal('new organization name');
            response.body.data.attributes.should.have.property('applications').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(organization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(organization.updatedAt);
        });
    })

    it('Update a organization that does not exist while being logged in as ADMIN user should return a 404 \'Organization not found\' error', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${new mongoose.Types.ObjectId().toString()}`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        response.status.should.equal(404);
        response.body.should.have.property('errors').and.be.an('array').and.length(1);
        response.body.errors[0].should.have.property('status').and.equal(404);
        response.body.errors[0].should.have.property('detail').and.equal('Organization not found');
    });

    it('Update a organization while being logged in as ADMIN should return a 200 and the user data (happy case - no user data provided)', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });

        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${organization._id.toString()}`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');

        const responseOrganization: Record<string, any> = response.body.data;

        responseOrganization.should.have.property('type').and.equal('organizations');
        response.body.data.should.have.property('id').and.equal(organization._id.toString());
        response.body.data.should.have.property('attributes').and.be.an('object');
        response.body.data.attributes.should.have.property('name').and.equal(organization.name);
        response.body.data.attributes.should.have.property('applications').and.eql([]);
        response.body.data.attributes.should.have.property('createdAt');
        new Date(response.body.data.attributes.createdAt).should.equalDate(organization.createdAt);
        response.body.data.attributes.should.have.property('updatedAt');
        new Date(response.body.data.attributes.updatedAt).should.equalDate(organization.updatedAt);
    });

    it('Update a organization while being logged in should return a 200 and the updated user data (happy case)', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });

        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${organization._id.toString()}`)
            .set('x-api-key', 'api-key-test')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'new organization name',
            });

        response.status.should.equal(200);

        const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

        response.body.should.have.property('data').and.be.an('object');
        response.body.data.should.have.property('type').and.equal('organizations');
        response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
        response.body.data.should.have.property('attributes').and.be.an('object');
        response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
        response.body.data.attributes.should.have.property('applications').and.eql([]);
        response.body.data.attributes.should.have.property('createdAt');
        new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
        response.body.data.attributes.should.have.property('updatedAt');
        new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);
    });

    describe('while being logged in as an organization ORG_ADMIN', () => {
        it('Update a organization should return a 200 and the user data (happy case)', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });
            mockGetUserById(testUser);

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                organization,
                userId: testUser.profile.legacyId,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.should.have.property('data').and.be.an('object');
            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(organization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('applications').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(organization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(organization.updatedAt);
        });

        it('Update an organization and setting user should be successful', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            mockGetUserById(testUser);

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                organization,
                userId: testUser.profile.legacyId,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUser.profile.legacyId, role: 'ORG_ADMIN' }]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUser.profile.legacyId,
                name: testUser.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and removing some users while retaining an admin should be successful', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const testUserOne: OktaUser = getMockOktaUser();
            const testUserTwo: OktaUser = getMockOktaUser();

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_MEMBER'
            }).save();
            await new OrganizationUserModel({
                userId: testUserTwo.profile.legacyId,
                organization,
                role: 'ORG_MEMBER'
            }).save();

            mockGetUserById(testUserTwo);

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{
                        id: testUserTwo.profile.legacyId,
                        role: 'ORG_ADMIN'
                    }]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUserTwo.profile.legacyId,
                name: testUserTwo.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ userId: testUserOne.profile.legacyId, organization });
            await assertConnection({ userId: testUserTwo.profile.legacyId, organization, role: 'ORG_ADMIN' });
        });

        it('Update an organization and replacing the ORG_ADMIN user should be successful', async () => {
            const testUserOne: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUserOne.profile.legacyId,
                email: testUserOne.profile.email,
                role: testUserOne.profile.role,
                extraUserData: { apps: testUserOne.profile.apps },
            });
            const testUserTwo: OktaUser = getMockOktaUser();

            mockGetUserById(testUserTwo);

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{
                        id: testUserTwo.profile.legacyId,
                        role: 'ORG_ADMIN'
                    }],
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users')
            response.body.data.attributes.users.should.eql([{
                id: testUserTwo.profile.legacyId,
                name: testUserTwo.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ userId: testUserOne.profile.legacyId, organization });
            await assertConnection({ userId: testUserTwo.profile.legacyId, organization });
        });

        it('Update an organization and setting an application owned by the ORG_ADMIN should be successful', async () => {
            const testUserOne: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUserOne.profile.legacyId,
                email: testUserOne.profile.email,
                role: testUserOne.profile.role,
                extraUserData: { apps: testUserOne.profile.apps },
            });

            mockGetUserById(testUserOne, 2);

            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new ApplicationUserModel({
                application: testApplication,
                userId: testUserOne.profile.legacyId,
            }).save();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplication.id]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name,
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ application: testApplication, organization });
            await assertNoConnection({ application: testApplication, userId: testUserOne.profile.legacyId });
        });

        it('Update an organization and setting an orphaned application should fail', async () => {
            const testUserOne: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUserOne.profile.legacyId,
                email: testUserOne.profile.email,
                role: testUserOne.profile.role,
                extraUserData: { apps: testUserOne.profile.apps },
            });

            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplication.id]
                });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');

            await assertNoConnection({ application: testApplication, organization });
        });

        it('Update an organization and setting an application owned by a different user should fail', async () => {
            const testUserOne: OktaUser = getMockOktaUser({ role: 'USER' });
            const testUserTwo: OktaUser = getMockOktaUser();
            const token: string = mockValidJWT({
                id: testUserOne.profile.legacyId,
                email: testUserOne.profile.email,
                role: testUserOne.profile.role,
                extraUserData: { apps: testUserOne.profile.apps },
            });

            mockGetUserById(testUserTwo);

            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new ApplicationUserModel({
                application: testApplication,
                userId: testUserTwo.profile.legacyId,
            }).save();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplication.id]
                });

            response.status.should.equal(403);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status').and.equal(403);
            response.body.errors[0].should.have.property('detail').and.equal('Not authorized');

            await assertConnection({ application: testApplication, userId: testUserTwo.profile.legacyId });
            await assertNoConnection({ application: testApplication, organization });
        });

        it('Update an organization and removing applications should be successful', async () => {
            const testUserOne: OktaUser = getMockOktaUser({ role: 'USER' });
            const token: string = mockValidJWT({
                id: testUserOne.profile.legacyId,
                email: testUserOne.profile.email,
                role: testUserOne.profile.role,
                extraUserData: { apps: testUserOne.profile.apps },
            });

            mockGetUserById(testUserOne);

            const testApplication: IApplication = await createApplication();

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationApplicationModel({ application: testApplication, organization }).save();

            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: []
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('applications').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ application: testApplication, organization });
        });
    })

    describe('with associated applications', () => {
        it('Update an organization without setting applications should be successful and not modify the associated applications', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplication: IApplication = await createApplication();

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationApplicationModel({ application: testApplication, organization }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name,
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ application: testApplication, organization });
        });

        it('Update an organization and setting application should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplication.id]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name,
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ application: testApplication, organization });
        });

        it('Update an organization and setting application should remove association with user and successful', async () => {
            const user: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: user.profile.legacyId,
                email: user.profile.email,
                role: user.profile.role,
                extraUserData: { apps: user.profile.apps },
            });

            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new ApplicationUserModel({
                userId: user.profile.legacyId,
                application: testApplication
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplication.id]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('applications').and.eql([{
                id: testApplication.id,
                name: testApplication.name,
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ application: testApplication, organization });
            await assertNoConnection({ application: testApplication, userId: user.profile.legacyId });
        });

        it('Update an organization and removing applications should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplication: IApplication = await createApplication();

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationApplicationModel({ application: testApplication, organization }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: []
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('applications').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ application: testApplication, organization });
        });

        it('Update an organization and overwriting existing applications should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplicationOne: IApplication = await createApplication();
            const testApplicationTwo: IApplication = await createApplication();

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationApplicationModel({ application: testApplicationOne, organization }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    applications: [testApplicationOne.id, testApplicationTwo.id]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('applications')
            response.body.data.attributes.applications.sort(sortByNestedName).should.eql(
                [{
                    id: testApplicationOne.id,
                    name: testApplicationOne.name,
                }, {
                    id: testApplicationTwo.id,
                    name: testApplicationTwo.name,
                }].sort(sortByNestedName)
            );
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ application: testApplicationOne, organization });
            await assertConnection({ application: testApplicationTwo, organization });
        });
    })

    describe('with associated users', () => {

        it('Update a organization with an empty users list should return a 400 error', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    users: []
                });

            response.status.should.equal(400);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status', 400);
            response.body.errors[0].should.have.property('detail', '"users" must contain at least 1 items');
        });

        it('Update a organization with users but no owners should return a 400 error', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: "my organization",
                    users: [{ id: testUser.profile.legacyId, role: 'ORG_MEMBER' }]

                });
            response.status.should.equal(400);
            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status', 400);
            response.body.errors[0].should.have.property('detail', '"users" must contain a user with role ORG_ADMIN');
        });

        it('Update an organization without setting users should be successful and not modify the application users', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            mockGetUserById(testUser);

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({ userId: testUser.profile.legacyId, organization, role: 'ADMIN' }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUser.profile.legacyId,
                name: testUser.profile.displayName,
                role: 'ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and setting user should be successful', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            mockGetUserById(testUser);

            const organization: HydratedDocument<IOrganization> = await createOrganization();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUser.profile.legacyId, role: 'ORG_ADMIN' }]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUser.profile.legacyId,
                name: testUser.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and setting user should not remove association with application and successful', async () => {
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const token: string = mockValidJWT({
                id: testUser.profile.legacyId,
                email: testUser.profile.email,
                role: testUser.profile.role,
                extraUserData: { apps: testUser.profile.apps },
            });

            mockGetUserById(testUser);

            const testApplication: IApplication = await createApplication();
            const organization: HydratedDocument<IOrganization> = await createOrganization();

            await new ApplicationUserModel({
                application: testApplication,
                userId: testUser.profile.legacyId
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUser.profile.legacyId, role: 'ORG_ADMIN' }]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUser.profile.legacyId,
                name: testUser.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ userId: testUser.profile.legacyId, organization });
            await assertConnection({
                userId: testUser.profile.legacyId,
                application: testApplication
            });
        });

        it('Update an organization and removing all users should fail', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: []
                });

            response.status.should.equal(400);

            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status', 400);
            response.body.errors[0].should.have.property('detail', '"users" must contain at least 1 items');

            await assertConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and setting some users but no ADMIN should fail', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUser.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUser.profile.legacyId, role: 'ORG_MEMBER' }]
                });

            response.status.should.equal(400);

            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status', 400);
            response.body.errors[0].should.have.property('detail', '"users" must contain a user with role ORG_ADMIN');

            await assertConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and setting more than one ORG_ADMIN should fail', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUserOne: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const testUserTwo: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [
                        { id: testUserOne.profile.legacyId, role: ORGANIZATION_ROLES.ORG_ADMIN },
                        { id: testUserTwo.profile.legacyId, role: ORGANIZATION_ROLES.ORG_ADMIN },
                    ]
                });

            response.status.should.equal(400);

            response.body.should.have.property('errors').and.be.an('array').and.length(1);
            response.body.errors[0].should.have.property('status', 400);
            response.body.errors[0].should.have.property('detail', '"users" must contain single a user with role ORG_ADMIN');

            await assertConnection({ userId: testUserOne.profile.legacyId, organization });
        });

        it('Update an organization and removing some users while retaining an admin should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUserOne: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const testUserTwo: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();
            await new OrganizationUserModel({
                userId: testUserTwo.profile.legacyId,
                organization,
                role: 'ORG_MEMBER'
            }).save();

            mockGetUserById(testUserTwo);

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{
                        id: testUserTwo.profile.legacyId,
                        role: 'ORG_ADMIN'
                    }]
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUserTwo.profile.legacyId,
                name: testUserTwo.profile.displayName,
                role: 'ORG_ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ userId: testUserOne.profile.legacyId, organization });
            await assertConnection({ userId: testUserTwo.profile.legacyId, organization, role: 'ORG_ADMIN' });
        });

        it('Update an organization and overwriting existing users should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUserOne: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const testUserTwo: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            mockGetUserById(testUserOne);
            mockGetUserById(testUserTwo);

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({
                userId: testUserOne.profile.legacyId,
                organization,
                role: 'ORG_ADMIN'
            }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('x-api-key', 'api-key-test')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{
                        id: testUserOne.profile.legacyId,
                        role: ORGANIZATION_ROLES.ORG_ADMIN
                    }, {
                        id: testUserTwo.profile.legacyId,
                        role: ORGANIZATION_ROLES.ORG_MEMBER
                    }],
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users')
            response.body.data.attributes.users.sort(sortByNestedName).should.eql([{
                id: testUserOne.profile.legacyId,
                name: testUserOne.profile.displayName,
                role: 'ORG_ADMIN'
            }, {
                id: testUserTwo.profile.legacyId,
                name: testUserTwo.profile.displayName,
                role: 'ORG_MEMBER'
            }].sort(sortByNestedName));
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({
                userId: testUserOne.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_ADMIN
            });
            await assertConnection({
                userId: testUserTwo.profile.legacyId,
                organization,
                role: ORGANIZATION_ROLES.ORG_MEMBER
            });
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
