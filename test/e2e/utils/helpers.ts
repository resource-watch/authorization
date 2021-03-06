import config from 'config';
import JWT from 'jsonwebtoken';
import Sinon, { SinonSandbox } from 'sinon';

import { OktaUser, IUser } from 'services/okta.interfaces';

export const getUUID: () => string = () => Math.random().toString(36).substring(7);

export const createTokenForUser: (tokenData: Partial<IUser>) => string = (tokenData: Partial<IUser>) => JWT.sign(tokenData, process.env.JWT_SECRET);

export const ensureHasPaginationElements: (response: ChaiHttp.Response) => void = (response: ChaiHttp.Response) => {
    response.body.should.have.property('links').and.be.an('object');

    response.body.links.should.have.property('self').and.be.a('string')
        .and.match(/page\[number]=\d+/)
        .and.match(/page\[size]=\d+/);

    response.body.links.should.have.property('first').and.be.a('string')
        .and.match(/page\[number]=1/)
        .and.match(/page\[size]=\d+/);

    response.body.links.should.have.property('prev').and.be.a('string')
        .and.match(/page\[number]=\d+/)
        .and.match(/page\[size]=\d+/);

    response.body.links.should.have.property('next').and.be.a('string')
        .and.match(/page\[number]=\d+/)
        .and.match(/page\[size]=\d+/);
};

export const ensureHasOktaPaginationElements: (response: ChaiHttp.Response, limit: number, cursor: string) => void = (response, limit, cursor) => {
    response.body.should.have.property('links').and.be.an('object');

    response.body.links.should.have.property('self').and.be.a('string')
        .and.contain(`page[size]=${limit}`)
        .and.contain(`page[before]=${cursor}`);

    response.body.links.should.have.property('first').and.be.a('string')
        .and.contain(`page[size]=${limit}`)
        .and.not.contain(`page[before]=${cursor}`)
        .and.not.contain(`page[after]=${cursor}`);

    response.body.links.should.have.property('next').and.be.a('string')
        .and.contain(`page[size]=${limit}`)
        .and.contain(`page[after]=${cursor}`);
};

export const stubConfigValue: (sandbox: Sinon.SinonSandbox, stubMap: Record<string, any>) => void = (sandbox: SinonSandbox, stubMap: Record<string, any>): void => {
    const stub: any = sandbox.stub(config, 'get');
    Object.keys(stubMap).forEach(key => {
        stub.withArgs(key).returns(stubMap[key]);
    });
    stub.callThrough();
};

export const assertOktaTokenInfo: (response: ChaiHttp.Response, user: OktaUser) => void = (response: ChaiHttp.Response, user: OktaUser) => {
    response.status.should.equal(200);
    response.body.should.have.property('_id').and.equal(user.profile.legacyId);
    response.body.should.have.property('extraUserData').and.be.an('object');
    response.body.extraUserData.should.have.property('apps').and.be.an('array').and.deep.equal(user.profile.apps);
    response.body.should.have.property('email').and.equal(user.profile.email);
    response.body.should.have.property('role').and.equal(user.profile.role);
    response.body.should.have.property('createdAt');
    response.body.should.have.property('updatedAt');
};
