import nock from 'nock';
import chai from 'chai';
import type request from 'superagent';
import JWT from 'jsonwebtoken';

import {JWTPayload, OktaUser} from 'services/okta.interfaces';
import { getUUID } from '../utils/helpers';
import { closeTestAgent, getTestAgent } from '../utils/test-server';
import {getMockOktaUser, mockValidJWT} from './okta.mocks';
import config from 'config';

chai.should();

let requester: ChaiHttp.Agent;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('[OKTA] GET generate token test suite', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestAgent();
    });

    it('Generating a JWT token while not being logged in should return 401 Unauthorized', async () => {
        const response: request.Response = await requester.get(`/auth/generate-token`);
        response.status.should.equal(401);
    });

    it('Generating a JWT token while being logged in should return 200 OK with a JWT token including the user information', async () => {
        const user: OktaUser = getMockOktaUser();
        const token: string = mockValidJWT({
            id: user.profile.legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: user.profile.apps },
        });

        const response: request.Response = await requester
            .get(`/auth/generate-token`)
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.should.have.property('token').and.be.a('string');

        const payload: JWTPayload = JWT.decode(response.body.token) as JWTPayload;
        payload.should.have.property('id').and.equal(user.profile.legacyId);
        payload.should.have.property('extraUserData').and.be.an('object');
        payload.extraUserData.should.have.property('apps').and.be.an('array').and.deep.equal(user.profile.apps);
        payload.should.have.property('email').and.equal(user.profile.email);
        payload.should.have.property('role').and.equal(user.profile.role);
        payload.should.have.property('createdAt');
    });

    it('Generating a JWT for a user which does not have all the required profile fields updates the user, returning 200 OK with a JWT token including the updated user information', async () => {
        const legacyId: string = getUUID();
        const user: OktaUser = getMockOktaUser();
        const token: string = JWT.sign({
            id: legacyId,
            email: user.profile.email,
            role: user.profile.role,
            extraUserData: { apps: [] },
            // Token age older than 1h to trigger validation in Okta
            iat: new Date('01-01-2000').getTime() / 1000,
        }, process.env.JWT_SECRET);

        // Delete some of the required fields
        delete user.profile.legacyId;
        delete user.profile.apps;
        delete user.profile.role;

        // Mock get user by email to return user info without required fields
        nock(config.get('okta.url'))
            .get(`/api/v1/users/${user.profile.email}`)
            .reply(200, { ...user });

        // Mock update of protected user fields
        nock(config.get('okta.url'))
            .post(`/api/v1/users/${user.id}`, (body) => !!body.profile.legacyId
                && body.profile.role === 'USER'
                && !!body.profile.apps
            )
            .reply(200, {
                ...user,
                profile: {
                    ...user.profile,
                    legacyId,
                    role: 'USER',
                    apps: [],
                }
            });

        const response: request.Response = await requester
            .get(`/auth/generate-token`)
            .set('Authorization', `Bearer ${token}`);

        response.status.should.equal(200);
        response.body.should.have.property('token').and.be.a('string');

        const payload: JWTPayload = JWT.decode(response.body.token) as JWTPayload;
        payload.should.have.property('id').and.equal(legacyId);
        payload.should.have.property('extraUserData').and.be.an('object');
        payload.extraUserData.should.have.property('apps').and.be.an('array').and.deep.equal([]);
        payload.should.have.property('email').and.equal(user.profile.email);
        payload.should.have.property('role').and.equal('USER');
        payload.should.have.property('createdAt');
    });

    after(async () => {
        await closeTestAgent();
    });

    afterEach(() => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });
});
