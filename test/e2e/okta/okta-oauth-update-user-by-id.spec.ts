import nock from 'nock';
import chai from 'chai';
import chaiDateTime from 'chai-datetime';

import { closeTestAgent, getTestAgent } from '../utils/test-server';
import type request from 'superagent';
import {OktaUser} from 'services/okta.interfaces';
import {
    getMockOktaUser,
    mockGetUserById,
    mockGetUserByIdNotFound,
    mockOktaUpdateUser,
    mockValidJWT
} from './okta.mocks';
import CacheService from 'services/cache.service';
import Should = Chai.Should;

const should: Should = chai.should();
chai.use(chaiDateTime);

let requester: ChaiHttp.Agent;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('[OKTA] Auth endpoints tests - Update user by id', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestAgent();
    });

    it('Updating a user while not logged in should return a 401', async () => {
        const response: request.Response = await requester
            .patch(`/auth/user/1`)
            .set('Content-Type', 'application/json');

        response.status.should.equal(401);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(401);
        response.body.errors[0].detail.should.equal('Not authenticated');
    });

    it('Updating a user while logged in as USER should return a 403', async () => {
        const user: OktaUser = getMockOktaUser({ role: 'USER' });
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        const response: request.Response = await requester
            .patch(`/auth/user/1`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(403);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(403);
        response.body.errors[0].detail.should.equal('Not authorized');
    });

    it('Updating a user while logged in as MANAGER should return a 403', async () => {
        const user: OktaUser = getMockOktaUser({ role: 'MANAGER' });
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        const response: request.Response = await requester
            .patch(`/auth/user/1`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(403);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(403);
        response.body.errors[0].detail.should.equal('Not authorized');
    });

    it('Updating a user with an id that does not match an existing user should return a 404', async () => {
        const token: string = mockValidJWT({ role: 'ADMIN' });
        mockGetUserByIdNotFound('1234');

        const response: request.Response = await requester
            .patch(`/auth/user/1234`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(404);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(404);
        response.body.errors[0].detail.should.equal('User not found');
    });

    it('Updating an existing user should return a 200 and the updated user data', async () => {
        const userToBeUpdated: OktaUser = getMockOktaUser();
        const token: string = mockValidJWT({ role: 'ADMIN' });

        mockGetUserById(userToBeUpdated);
        mockOktaUpdateUser(userToBeUpdated, {
            displayName: 'changed name',
            photo: 'http://www.changed-photo.com',
            role: 'MANAGER',
            apps: ['changed-apps'],
        });

        const response: request.Response = await requester
            .patch(`/auth/user/${userToBeUpdated.profile.legacyId}`)
            .set('Content-Type', 'application/json')
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
        response.body.data.should.have.property('id').and.equal(userToBeUpdated.profile.legacyId);
        response.body.data.should.have.property('email').and.equal(userToBeUpdated.profile.email);
        response.body.data.should.have.property('createdAt');
        response.body.data.should.have.property('updatedAt');
    });

    it('Redis cache is cleared after a user is updated', async () => {
        const userToBeUpdated: OktaUser = getMockOktaUser();
        const token: string = mockValidJWT({ role: 'ADMIN' });

        mockGetUserById(userToBeUpdated);
        mockOktaUpdateUser(userToBeUpdated, { displayName: 'changed name' });

        // Assert value does not exist in cache before
        const value: OktaUser = await CacheService.get(`okta-user-${userToBeUpdated.profile.legacyId}`);
        should.not.exist(value);

        // Store it in cache
        await CacheService.set(`okta-user-${userToBeUpdated.profile.legacyId}`, userToBeUpdated);
        const value2: OktaUser = await CacheService.get(`okta-user-${userToBeUpdated.profile.legacyId}`);
        should.exist(value2);

        const response: request.Response = await requester
            .patch(`/auth/user/${userToBeUpdated.profile.legacyId}`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'changed name' });

        response.status.should.equal(200);

        // Assert value does not exist in cache after
        const value3: OktaUser = await CacheService.get(`okta-user-${userToBeUpdated.profile.legacyId}`);
        should.not.exist(value3);
    });

    after(async () => {
        await closeTestAgent();
    });

    afterEach(async () => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });
});
