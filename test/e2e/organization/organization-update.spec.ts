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
import OrganizationUserModel from "models/organization-user";
import ApplicationUserModel from "models/application-user";
import { OktaUser } from "services/okta.interfaces";

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
            .send({});

        response.status.should.equal(401);
        response.body.should.have.property('errors').and.be.an('array').and.length(1);
        response.body.errors[0].should.have.property('status').and.equal(401);
        response.body.errors[0].should.have.property('detail').and.equal('Not authenticated');
    });

    it('Update a organization while being logged in as USER should return a 403 \'Forbidden\' error', async () => {
        const token: string = mockValidJWT({ role: 'USER' });

        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${organization._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        response.status.should.equal(403);
        response.body.should.have.property('errors').and.be.an('array').and.length(1);
        response.body.errors[0].should.have.property('status').and.equal(403);
        response.body.errors[0].should.have.property('detail').and.equal('Not authorized');
    });

    it('Update a organization that does not exist while being logged in as ADMIN user should return a 404 \'Organization not found\' error', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${new mongoose.Types.ObjectId().toString()}`)
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

    it('Update a organization while being logged in should return a 200 and the updated user data (happy case, regen api key)', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });

        const organization: HydratedDocument<IOrganization> = await createOrganization();

        const response: request.Response = await requester
            .patch(`/api/v1/organization/${organization._id.toString()}`)
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

    describe('with associated applications', () => {
        it('Update an organization without setting applications should be successful and not modify the associated applications', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testApplication: IApplication = await createApplication();

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationApplicationModel({ application: testApplication, organization }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
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
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{id: testUser.profile.legacyId, role: 'ADMIN'}]
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
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUser.profile.legacyId, role: 'ADMIN' }]
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
            await assertConnection({
                userId: testUser.profile.legacyId,
                application: testApplication
            });
        });

        it('Update an organization and removing users should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUser: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({ userId: testUser.profile.legacyId, organization, role: 'ADMIN' }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: []
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name).and.equal('new organization name');
            response.body.data.attributes.should.have.property('users').and.eql([]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertNoConnection({ userId: testUser.profile.legacyId, organization });
        });

        it('Update an organization and overwriting existing users should be successful', async () => {
            const token: string = mockValidJWT({ role: 'ADMIN' });
            const testUserOne: OktaUser = getMockOktaUser({ role: 'ADMIN' });
            const testUserTwo: OktaUser = getMockOktaUser({ role: 'ADMIN' });

            mockGetUserById(testUserOne);
            mockGetUserById(testUserTwo);

            const organization: HydratedDocument<IOrganization> = await createOrganization();
            await new OrganizationUserModel({ userId: testUserOne.profile.legacyId, organization, role: 'ADMIN' }).save();

            const response: request.Response = await requester
                .patch(`/api/v1/organization/${organization._id.toString()}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'new organization name',
                    users: [{ id: testUserOne.profile.legacyId, role: 'ADMIN' }, {
                        id: testUserTwo.profile.legacyId,
                        role: 'ADMIN'
                    }],
                });

            response.status.should.equal(200);

            const databaseOrganization: IOrganization = await OrganizationModel.findById(response.body.data.id);

            response.body.data.should.have.property('type').and.equal('organizations');
            response.body.data.should.have.property('id').and.equal(databaseOrganization._id.toString());
            response.body.data.should.have.property('attributes').and.be.an('object');
            response.body.data.attributes.should.have.property('name').and.equal(databaseOrganization.name);
            response.body.data.attributes.should.have.property('users')
            response.body.data.attributes.should.have.property('users').and.eql([{
                id: testUserOne.profile.legacyId,
                name: testUserOne.profile.displayName,
                role: 'ADMIN'
            }, {
                id: testUserTwo.profile.legacyId,
                name: testUserTwo.profile.displayName,
                role: 'ADMIN'
            }]);
            response.body.data.attributes.should.have.property('createdAt');
            new Date(response.body.data.attributes.createdAt).should.equalDate(databaseOrganization.createdAt);
            response.body.data.attributes.should.have.property('updatedAt');
            new Date(response.body.data.attributes.updatedAt).should.equalDate(databaseOrganization.updatedAt);

            await assertConnection({ userId: testUserOne.profile.legacyId, organization });
            await assertConnection({ userId: testUserTwo.profile.legacyId, organization });
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
