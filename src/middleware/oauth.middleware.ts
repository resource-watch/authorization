import Application, { Context } from "koa";
import passport from 'koa-passport';
import jwt, { Options } from 'koa-jwt';
import views from 'koa-views';

import logger from 'logger';
import registerStrategies from 'services/passport.service';
import AuthService from 'services/auth.service';
import Settings from "services/settings.service";

export async function middleware(app: Application) {
    logger.info('Loading oauth-plugin');
    app.use(views(`${__dirname}/../views`, { extension: 'ejs' }));
    await registerStrategies();
    app.use(passport.initialize());
    app.use(passport.session());

    const getToken = (ctx: Context, opts: Options) => {
        // External requests use the standard 'authorization' header, but internal requests use 'authentication' instead
        // so we need a custom function to load the token. Why don't we use authorization on both will always elude me...

        if (!ctx.headers || (!ctx.headers.authorization && !ctx.headers.authentication)) {
            return;
        }

        if (ctx.headers.authentication) {
            return ctx.headers.authentication;
        }

        const parts = ctx.headers.authorization.split(' ');

        if (parts.length === 2) {
            const scheme = parts[0];
            const credentials = parts[1];

            if (/^Bearer$/i.test(scheme)) {
                return credentials;
            }
        }
        if (!opts.passthrough) {
            ctx.throw(401, 'Bad Authorization header format. Format is "Authorization: Bearer <token>"');
        }
    };

    logger.info('JWT active');
    app.use(jwt({
        secret: Settings.getSettings().jwt.secret,
        passthrough: Settings.getSettings().jwt.passthrough,
        isRevoked: AuthService.checkRevokedToken,
        getToken
    }));

    app.use(async (ctx: Context, next: () => Promise<any>) => {
        if (ctx.state.jwtOriginalError && ctx.state.jwtOriginalError.message === 'Token revoked') {
            return ctx.throw(401, 'Your token is outdated. Please use /auth/login to login and /auth/generate-token to generate a new token.');
        }
        if (ctx.state.jwtOriginalError && ctx.state.jwtOriginalError.message === 'jwt malformed') {
            return ctx.throw(401, 'Your token is invalid. Please use /auth/login to login and /auth/generate-token to generate a new token.');
        }

        return next();
    });
}
