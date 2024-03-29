import axios, { AxiosHeaders, AxiosRequestHeaders, AxiosResponse } from 'axios';
import config from 'config';
import JWT from 'jsonwebtoken';
import mongoose from 'mongoose';

import {
    IUserId,
    OktaCreateUserPayload,
    OktaOAuthTokenPayload,
    OktaSuccessfulLoginResponse,
    OktaUpdateUserPayload,
    OktaUpdateUserProtectedFieldsPayload,
    OktaUser,
} from 'services/okta.interfaces';
import logger from 'logger';

export default class OktaApiService {
    private static oktaRequestHeaders(): AxiosRequestHeaders {
        const headers: AxiosHeaders = new AxiosHeaders({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `SSWS ${config.get('okta.apiKey')}`,
        });


        return headers;
    }

    static async getOktaUserListPaginatedResult(search: string, limit: number, after: string, before: string): Promise<{
        data: OktaUser[],
        cursor: string
    }> {
        const response: AxiosResponse = await axios.get(`${config.get('okta.url')}/api/v1/users`, {
            headers: OktaApiService.oktaRequestHeaders(),
            params: {
                ...(search && { search }),
                ...(limit && { limit }),
                ...(after && { after }),
                ...(before && { before }),
            }
        });

        // Find cursor in link header
        const afterMatches: RegExpExecArray = /after=(\w+)[^;]*; rel="next"/gm.exec(response.headers.link);

        return {
            data: response.data,
            cursor: afterMatches && afterMatches[1],
        };
    }

    static async getOktaUserList(search: string, limit: string, after: string, before: string): Promise<OktaUser[]> {
        const { data }: { data: OktaUser[] } = await axios.get(`${config.get('okta.url')}/api/v1/users`, {
            headers: OktaApiService.oktaRequestHeaders(),
            params: {
                ...(search && { search }),
                ...(limit && { limit }),
                ...(after && { after }),
                ...(before && { before }),
            }
        });

        return data;
    }

    static async getOktaUserByEmail(email: string): Promise<OktaUser> {
        const { data }: { data: OktaUser } = await axios.get(
            `${config.get('okta.url')}/api/v1/users/${email}`,
            { headers: OktaApiService.oktaRequestHeaders() }
        );

        return data;
    }

    static async getOktaUserById(oktaId: IUserId): Promise<OktaUser> {
        const { data }: { data: OktaUser } = await axios.get(
            `${config.get('okta.url')}/api/v1/users/${oktaId}`,
            { headers: OktaApiService.oktaRequestHeaders() }
        );
        logger.info(`[OktaApiService - getOktaUserById] - got user data from Okta: `, JSON.stringify(data));
        return data;
    }

    static async postPasswordRecoveryEmail(email: string): Promise<void> {
        return axios.post(
            `${config.get('okta.url')}/api/v1/authn/recovery/password`,
            { username: email, 'factorType': 'EMAIL' },
            { headers: OktaApiService.oktaRequestHeaders() }
        );
    }

    static async postUserActivate(oktaId: IUserId, sendEmail: boolean = true): Promise<void> {
        return axios.post(
            `${config.get('okta.url')}/api/v1/users/${oktaId}/lifecycle/activate?sendEmail=${sendEmail}`,
            {},
            { headers: OktaApiService.oktaRequestHeaders() }
        );
    }

    static async postLogin(username: string, password: string): Promise<OktaSuccessfulLoginResponse> {
        const { data }: { data: OktaSuccessfulLoginResponse } = await axios.post(
            `${config.get('okta.url')}/api/v1/authn`,
            { username, password },
            { headers: OktaApiService.oktaRequestHeaders() }
        );

        return data;
    }

    // Returns Okta user ID
    static async postOAuthToken(code: string): Promise<string> {
        const basicAuth: string = Buffer
            .from(`${config.get('okta.clientId')}:${config.get('okta.clientSecret')}`)
            .toString('base64');

        const { data } = await axios.post(
            `${config.get('okta.url')}/oauth2/default/v1/token`,
            {
                grant_type: 'authorization_code',
                redirect_uri: `${config.get('server.publicUrl')}/auth/authorization-code/callback`,
                code,
            },
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${basicAuth}`
                }
            },
        );

        const { uid } = JWT.decode(data.access_token) as OktaOAuthTokenPayload;
        return uid;
    }

    static async postUser(payload: OktaCreateUserPayload): Promise<OktaUser> {
        const { data }: { data: OktaUser } = await axios.post(
            `${config.get('okta.url')}/api/v1/users?activate=false`,
            {
                profile: {
                    email: payload.email,
                    login: payload.email,
                    displayName: payload.name,
                    provider: payload.provider,
                    origin: payload.origin || '',
                    legacyId: payload.legacyId || new mongoose.Types.ObjectId(),
                    role: payload.role || 'USER',
                    apps: payload.apps || [],
                    photo: payload.photo || null,
                    providerId: payload.providerId || null,
                }
            },
            { headers: OktaApiService.oktaRequestHeaders() }
        );

        return data;
    }

    static async postUserByOktaId(
        oktaId: IUserId,
        payload: OktaUpdateUserPayload | OktaUpdateUserProtectedFieldsPayload
    ): Promise<OktaUser> {
        const { data }: { data: OktaUser } = await axios.post(
            `${config.get('okta.url')}/api/v1/users/${oktaId}`,
            { profile: payload },
            { headers: OktaApiService.oktaRequestHeaders() }
        );

        return data;
    }

    static async postUserProtectedFieldsByOktaId(oktaId: IUserId, payload: OktaUpdateUserProtectedFieldsPayload): Promise<OktaUser> {
        const postRequestBody: Record<string, any> = { profile: payload };

        if (payload.password) {
            postRequestBody.credentials = { password: { value: payload.password } };
            delete postRequestBody.profile.password;
        }

        const { data }: { data: OktaUser } = await axios.post(
            `${config.get('okta.url')}/api/v1/users/${oktaId}`,
            postRequestBody,
            { headers: OktaApiService.oktaRequestHeaders() }
        );

        return data;
    }

    static async deleteUserByOktaId(oktaId: IUserId): Promise<void> {
        logger.info(`[OktaApiService] Deleting user with Okta ID ${oktaId}`);
        return axios.delete(
            `${config.get('okta.url')}/api/v1/users/${oktaId}`,
            { headers: OktaApiService.oktaRequestHeaders() }
        );
    }

    static async deleteUserSession(oktaId: IUserId): Promise<void> {
        logger.info(`[OktaApiService] Deleting user sessions with Okta ID ${oktaId}`);
        return axios.delete(
            `${config.get('okta.url')}/api/v1/users/${oktaId}/sessions`,
            { headers: OktaApiService.oktaRequestHeaders() }
        );
    }
}
