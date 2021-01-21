import nock from "nock";
import config from "config";
import faker from 'faker';

import {
    JWTPayload,
    OktaFailedAPIResponse,
    OktaSuccessfulLoginResponse,
    OktaUser,
    OktaUserProfile
} from "services/okta.interfaces";
import {createTokenForUser} from "../utils/helpers";

export const getMockOktaUser: (override?: Partial<OktaUserProfile>) => OktaUser = (override = {}) => {
    const email: string = faker.internet.email();
    const firstName: string = faker.name.firstName();
    const lastName: string = faker.name.lastName();
    return {
        "id": faker.random.uuid(),
        "status": "PROVISIONED",
        "created": "2020-11-05T22:24:09.000Z",
        "activated": "2020-11-05T22:24:09.000Z",
        "statusChanged": "2020-11-05T22:24:09.000Z",
        "lastLogin": null,
        "lastUpdated": "2020-11-05T22:24:09.000Z",
        "passwordChanged": null,
        "type": { "id": faker.random.uuid() },
        "profile": {
            legacyId: faker.random.uuid(),
            login: email,
            email,
            role: 'USER',
            provider: 'okta',
            apps: ['rw'],
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`,
            photo: faker.image.imageUrl(),
            ...override,
        },
        "credentials": {
            "provider": {
                "type": "OKTA",
                "name": "OKTA"
            }
        },
        "_links": {
            "self": {
                "href": "https://wri.okta.com/api/v1/users/00uk4x3281Yka1zn85d5"
            }
        }
    };
};

export const mockOktaListUsers: (query?: {}, users?: OktaUser[], statusCode?: number) => void = (
    query = {},
    users: OktaUser[] = [],
    statusCode = 200,
) => {
    nock(config.get('okta.url'))
        .get('/api/v1/users')
        .query(query)
        .reply(statusCode, users);
};

export const mockOktaSuccessfulLogin: () => OktaSuccessfulLoginResponse = () => {
    const successfulLoginResponse: OktaSuccessfulLoginResponse = {
        "expiresAt": "2021-01-19T11:29:41.000Z",
        "status": "SUCCESS",
        "sessionToken": "20111upCJzH_F3NPjEgqPFNjJGprtSWwjbl8Ehvv_EyYk10wbaUY83L",
        "_embedded": {
            "user": {
                "id": "00ukgm6zKTLFgB4Qf5d5",
                "passwordChanged": "2020-11-06T16:15:53.000Z",
                "profile": {
                    "login": faker.internet.email(),
                    "firstName": faker.name.firstName(),
                    "lastName": faker.name.lastName(),
                    "locale": "en",
                    "timeZone": "America/Los_Angeles"
                }
            }
        }
    };

    nock(config.get('okta.url'))
        .post('/api/v1/authn')
        .reply(200, successfulLoginResponse);

    return successfulLoginResponse;
};

export const mockOktaFailedLogin: () => OktaFailedAPIResponse = () => {
    const failedLoginResponse: OktaFailedAPIResponse = {
        "errorCode": "E0000004",
        "errorSummary": "Authentication failed",
        "errorLink": "E0000004",
        "errorId": "oaeXDfN2vJFQlyrTZJGc3FrAA",
        "errorCauses": []
    };

    nock(config.get('okta.url'))
        .post('/api/v1/authn')
        .reply(401, failedLoginResponse);

    return failedLoginResponse;
};

export const mockOktaGetUserByEmail: (override: Partial<OktaUserProfile>, times?: number) => OktaUser = (override = {}, times = 1) => {
    const user: OktaUser = getMockOktaUser(override);

    nock(config.get('okta.url'))
        .get(`/api/v1/users/${user.profile.email}`)
        .times(times)
        .reply(200, { ...user });

    return user;
};

export const generateRandomTokenPayload: (override?: Partial<JWTPayload>) => JWTPayload = (override = {}) => {
    const id: string = faker.random.uuid();
    const email: string = faker.internet.email();
    const role: string = 'USER';
    const extraUserData: { apps: string[]; } = { apps: ['rw'] };
    return { id, email, role, extraUserData, ...override };
};

export const mockValidJWT: (override?: Partial<JWTPayload>, times?: number) => string = (override = {}, times = 1) => {
    const tokenPayload: JWTPayload = generateRandomTokenPayload(override);
    const token: string = createTokenForUser(tokenPayload);

    mockOktaGetUserByEmail({
        legacyId: tokenPayload.id,
        email: tokenPayload.email,
        role: tokenPayload.role,
        apps: tokenPayload.extraUserData.apps,
    }, times);

    return token;
};

export const mockOktaSuccessfulSignUp: (override?: Partial<OktaUserProfile>) => OktaUser = (override = {}) => {
    const user: OktaUser = getMockOktaUser(override);

    nock(config.get('okta.url'))
        .post('/api/v1/users?activate=false')
        .reply(200, user);

    nock(config.get('okta.url'))
        .post(`/api/v1/users/${user.id}/lifecycle/activate?sendEmail=true`)
        .reply(200, user);

    return user;
};

export const mockOktaFailedSignUp: (errorSummary: string) => OktaFailedAPIResponse = (errorSummary: string) => {
    const failedLoginResponse: OktaFailedAPIResponse = {
        "errorCode": "E0000004",
        errorSummary,
        "errorLink": "E0000004",
        "errorId": "oaeXDfN2vJFQlyrTZJGc3FrAA",
        "errorCauses": [{ errorSummary }],
    };

    nock(config.get('okta.url'))
        .post('/api/v1/users?activate=false')
        .reply(401, failedLoginResponse);

    return failedLoginResponse;
};
