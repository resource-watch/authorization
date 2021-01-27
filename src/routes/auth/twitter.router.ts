import Router from 'koa-router';
import logger from 'logger';
import passport from 'koa-passport';
import Settings, { IApplication, ISettings } from 'services/settings.service';
import UserService from 'services/user.service';
import { UserDocument } from 'models/user.model';
import { IUser } from 'models/user.model';
import { Context, Next } from 'koa';

const router: Router = new Router({ prefix: '/auth/twitter' });

const getUser: (ctx: Context) => UserDocument = (ctx: Context) => ctx.request.query.user || ctx.state.user;

const getOriginApp: (ctx: Context, config: ISettings) => string = (ctx: Context, config: ISettings) => {
    if (ctx.query.origin) {
        return ctx.query.origin;
    }

    if (ctx.session && ctx.session.originApplication) {
        return ctx.session.originApplication;
    }

    return config.defaultApp;
};

class TwitterRouter {

    static async redirectStart(ctx: Context): Promise<void> {
        ctx.redirect(`${Settings.getSettings().publicUrl}/auth/twitter/start`);
    }

    static async startMigration(ctx: Context): Promise<void> {
        const app: string = getOriginApp(ctx, Settings.getSettings());

        return ctx.render('start', {
            error: false,
            app
        });
    }

    static async twitter(ctx: Context, next: Next): Promise<void> {
        const app: string = getOriginApp(ctx, Settings.getSettings());
        // @ts-ignore
        await passport.authenticate(`twitter:${app}`)(ctx, next);
    }

    static async twitterCallbackAuthentication(ctx: Context, next: Next): Promise<void> {
        const app: string = getOriginApp(ctx, Settings.getSettings());
        // @ts-ignore
        await passport.authenticate(`twitter:${app}`, { failureRedirect: '/auth/twitter/fail', failureFlash: true })(ctx, next);
    }

    static async redirectToMigrate(ctx: Context): Promise<void> {
        await ctx.login(getUser(ctx));
        ctx.redirect('/auth/twitter/migrate');
    }

    static async migrateView(ctx: Context): Promise<void> {
        if (!ctx.session) {
            logger.info('No session found. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        const user: UserDocument = getUser(ctx);
        if (!user) {
            logger.info('No user found in current session when presenting the migration form. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        return ctx.render('migrate', {
            error: false,
            email: user.email
        });
    }

    static async migrate(ctx: Context): Promise<void> {
        if (!ctx.session) {
            logger.info('No user found in current session when presenting the migration form. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        const sessionUser: UserDocument = getUser(ctx);
        if (!sessionUser) {
            logger.info('No user found in current session when presenting the migration form. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        logger.info('Migrating user');
        let error: string = null;
        if (!ctx.request.body.email || !ctx.request.body.password || !ctx.request.body.repeatPassword) {
            error = 'Email, Password and Repeat password are required';
        }
        if (ctx.request.body.password !== ctx.request.body.repeatPassword) {
            error = 'Password and Repeat password not equal';
        }

        if (error) {
            await ctx.render('migrate', {
                error,
                email: ctx.request.body.email
            });

            return;
        }

        const user: UserDocument = await UserService.getUserById(sessionUser.id);
        if (!user) {
            error = 'Could not find a valid user account for the current session';
        }

        const migratedUser: UserDocument = await UserService.migrateToUsernameAndPassword(user, ctx.request.body.email, ctx.request.body.password);

        if (error) {
            await ctx.render('migrate', {
                error,
                email: ctx.request.body.email
            });

            return;
        }

        await ctx.login(migratedUser);

        return ctx.redirect('/auth/twitter/finished');
    }

    static async finished(ctx: Context): Promise<void> {
        if (!ctx.session) {
            logger.info('No user found in current session when presenting the migration form. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        const sessionUser: UserDocument = getUser(ctx);
        if (!sessionUser) {
            logger.info('No user found in current session when presenting the migration form. Redirecting to the migration start page.');
            return ctx.redirect('/auth/twitter/start');
        }

        return ctx.render('finished');
    }

    static async failAuth(ctx: Context): Promise<void> {
        logger.info('Not authenticated');
        const app: string = getOriginApp(ctx, Settings.getSettings());

        const error:string = ctx.flash('error');

        return ctx.render('start', {
            error,
            app
        });
    }
}

async function loadApplicationGeneralConfig(ctx: Context, next: Next): Promise<void> {
    const config: ISettings = await Settings.getSettings();

    const app: string = getOriginApp(ctx, config);
    const applicationConfig: IApplication = config.applications && config.applications[app];

    if (applicationConfig) {
        ctx.state.application = applicationConfig;
    }

    await next();
}

// @ts-ignore
router.get('/', TwitterRouter.redirectStart);
router.get('/start', loadApplicationGeneralConfig, TwitterRouter.startMigration);
// @ts-ignore
router.get('/auth', TwitterRouter.twitter);
router.get('/callback', TwitterRouter.twitterCallbackAuthentication, TwitterRouter.redirectToMigrate);
router.get('/migrate', loadApplicationGeneralConfig, TwitterRouter.migrateView);
router.post('/migrate', loadApplicationGeneralConfig, TwitterRouter.migrate);
router.get('/finished', loadApplicationGeneralConfig, TwitterRouter.finished);
router.get('/fail', loadApplicationGeneralConfig, TwitterRouter.failAuth);


export { router };
