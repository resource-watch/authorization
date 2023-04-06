import { Context, Next } from 'koa';
import logger from 'logger';
import Settings from 'services/settings.service';
import { IUser, IUserLegacyId } from 'services/okta.interfaces';
import { URL } from 'url';
import { PaginateOptions } from 'mongoose';
import { IOrganizationId } from "models/organization";
import OrganizationUserModel, { IOrganizationUser, ORGANIZATION_ROLES } from "models/organization-user";

export default class Utils {

    static getPaginationParameters(ctx: Context): PaginateOptions {
        let page: number = 1;
        let limit: number = 10;

        if (ctx.query.page) {
            // tslint:disable-next-line:variable-name
            const { number, size } = (ctx.query.page as Record<string, any>);
            page = number ? parseInt(number, 10) : 1;
            limit = size ? parseInt(size, 10) : 10;
        }

        return {
            page,
            limit
        };
    }

    static getUser(ctx: Context): IUser {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return ctx.req.user || ctx.state.user || ctx.state.microservice;
    }

    static async isLogged(ctx: Context, next: Next): Promise<void> {
        logger.debug('Checking if user is logged');
        if (Utils.getUser(ctx)) {
            await next();
        } else {
            logger.debug('Not logged');
            ctx.throw(401, 'Not authenticated');
        }
    }

    static async isAdmin(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is admin');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN') {
            logger.info('User is admin');
            await next();
        } else {
            logger.info('Not admin');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isAdminOrOrgAdmin(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is admin or organization admin');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN') {
            logger.info('User is admin');
            await next();
            return ;
        }

        const organizationId: IOrganizationId = ctx.params.id;
        const query: {
            role: "ORG_MEMBER" | "ORG_ADMIN";
            organization: IOrganizationId;
            user: IUserLegacyId
        } = {
            role: ORGANIZATION_ROLES.ORG_ADMIN,
            organization: organizationId,
            user: user.id
        }
        const organizationUser: IOrganizationUser = await OrganizationUserModel.findOne(query);
        if (organizationUser) {
            logger.info('User is org admin');
            await next();
        } else {
            logger.info('Not org admin');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isAdminOrOrgUser(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is admin or belongs to organization');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN') {
            logger.info('User is admin');
            await next();
            return ;
        }

        const organizationId: IOrganizationId = ctx.params.id;
        const query: {
            organization: IOrganizationId;
            user: IUserLegacyId
        } = {
            organization: organizationId,
            user: user.id
        }
        const organizationUser: IOrganizationUser = await OrganizationUserModel.findOne(query);
        if (organizationUser) {
            logger.info('User belongs to organization');
            await next();
        } else {
            logger.info('Does not belong to organization');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isAdminOrManager(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is admin or manager');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN' || user.role === 'MANAGER') {
            await next();
        } else {
            logger.info('Not admin');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isAdminOrMicroserviceOrSameUserToDelete(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is admin or same user to delete');
        const user: IUser = Utils.getUser(ctx);
        const userIdToDelete: string = ctx.params.id;
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN' || user.id === 'microservice' || user.id === userIdToDelete) {
            await next();
        } else {
            logger.info('Not admin nor same user to be deleted');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isMicroservice(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is a microservice');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.id === 'microservice') {
            await next();
        } else {
            logger.info('Not admin');
            ctx.throw(403, 'Not authorized');
        }
    }

    static async isAdminOrMicroservice(ctx: Context, next: Next): Promise<void> {
        logger.info('Checking if user is a microservice');
        const user: IUser = Utils.getUser(ctx);
        if (!user) {
            logger.info('Not authenticated');
            ctx.throw(401, 'Not authenticated');
            return;
        }
        if (user.role === 'ADMIN' || user.id === 'microservice') {
            await next();
        } else {
            logger.info('Not admin nor microservice');
            ctx.throw(403, 'Not authorized');
        }
    }

    static getOriginApp(ctx: Context): string {
        if (ctx.query.origin) {
            return ctx.query.origin as string;
        }

        if (ctx.session?.originApplication) {
            return ctx.session.originApplication;
        }

        return Settings.getSettings().defaultApp;
    }

    static serializeObjToQuery(obj: Record<string, any>): string {
        return Object.keys(obj).reduce((a: any[], k: string) => {
            a.push(`${k}=${encodeURIComponent(obj[k])}`);
            return a;
        }, []).join('&');
    }

    static getHostForPaginationLink(ctx: Context): string {
        if ('x-rw-domain' in ctx.request.header) {
            return ctx.request.header['x-rw-domain'] as string;
        }

        if ('referer' in ctx.request.header) {
            const url: URL = new URL(ctx.request.header.referer);
            return url.host;
        }
        return ctx.request.host;
    }
}
