const passport = require('koa-passport');
const { omit } = require('lodash');
const logger = require('logger');
const mongoose = require('mongoose');

const Utils = require('utils');

const Plugin = require('models/plugin.model');
const authServiceFunc = require('./services/auth.service');
const UnprocessableEntityError = require('./errors/unprocessableEntity.error');
const UnauthorizedError = require('./errors/unauthorized.error');
const UserTempSerializer = require('./serializers/user-temp.serializer');
const UserSerializer = require('./serializers/user.serializer');
const mongooseOptions = require('../../../../config/mongoose');

const getAuthService = async () => {
    const generalConfig = Utils.getGeneralConfig();
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const connection = mongoose.createConnection(`${generalConfig.mongoUri}`, mongooseOptions);
    return authServiceFunc(plugin, connection);
};

const twitter = async (ctx) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`twitter:${app}`)(ctx);
};

const twitterCallback = async (ctx, next) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`twitter:${app}`, {
        failureRedirect: '/auth/fail',
    })(ctx, next);
};

const facebook = async (ctx) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`facebook:${app}`, {
        scope: plugin.config.thirdParty[app] ? plugin.config.thirdParty[app].facebook.scope : [],
    })(ctx);
};

const facebookToken = async (ctx, next) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`facebook-token:${app}`)(ctx, next);
};

const facebookCallback = async (ctx, next) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`facebook:${app}`, {
        failureRedirect: '/auth/fail',
    })(ctx, next);
};

const google = async (ctx) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`google:${app}`, {
        scope: (plugin.config.thirdParty[app] && plugin.config.thirdParty[app].google.scope) ? plugin.config.thirdParty[app].google.scope : ['openid'],
    })(ctx);
};

const googleToken = async (ctx, next) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`google-token:${app}`)(ctx, next);
};

const googleCallback = async (ctx, next) => {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const app = Utils.getOriginApp(ctx, plugin);
    await passport.authenticate(`google:${app}`, {
        failureRedirect: '/auth/fail',
    })(ctx, next);
};

const localCallback = async (ctx) => passport.authenticate('local', async (user) => {
    if (!user) {
        if (ctx.request.type === 'application/json') {
            ctx.status = 401;
            ctx.body = {
                errors: [{
                    status: 401,
                    detail: 'Invalid email or password'
                }]
            };
            return;
        }

        ctx.redirect('/auth/fail?error=true');
        return;
    }

    if (ctx.request.type === 'application/json') {
        ctx.status = 200;
        logger.info('Generating token');
        const AuthService = await getAuthService();
        const token = await AuthService.createToken(user, false);
        ctx.body = UserTempSerializer.serialize(user);
        ctx.body.data.token = token;
    } else {
        await ctx.logIn(user)
            .then(() => ctx.redirect('/auth/success'))
            .catch(() => ctx.redirect('/auth/fail?error=true'));
    }
})(ctx);

async function createToken(ctx, saveInUser) {
    logger.info('Generating token');
    const AuthService = await getAuthService();
    return AuthService.createToken(Utils.getUser(ctx), saveInUser);
}

async function generateJWT(ctx) {
    logger.info('Generating token');
    try {
        const token = await createToken(ctx, true);
        ctx.body = {
            token,
        };
    } catch (e) {
        logger.info(e);
    }
}

async function checkLogged(ctx) {
    if (Utils.getUser(ctx)) {
        const userToken = Utils.getUser(ctx);
        const AuthService = await getAuthService();
        const user = await AuthService.getUserById(userToken.id);

        ctx.body = {
            id: user._id,
            name: user.name,
            photo: user.photo,
            provider: user.provider,
            providerId: user.providerId,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            extraUserData: user.extraUserData
        };

    } else {
        ctx.res.statusCode = 401;
        ctx.throw(401, 'Not authenticated');
    }
}

async function getUsers(ctx) {
    logger.info('Get Users');
    const user = Utils.getUser(ctx);
    if (!user.extraUserData || !user.extraUserData.apps) {
        ctx.throw(403, 'Not authorized');
        return;
    }

    const { apps } = user.extraUserData;
    const { query } = ctx;

    const clonedQuery = { ...query };
    delete clonedQuery['page[size]'];
    delete clonedQuery['page[number]'];
    delete clonedQuery.ids;
    delete clonedQuery.loggedUser;
    const serializedQuery = Utils.serializeObjToQuery(clonedQuery) ? `?${Utils.serializeObjToQuery(clonedQuery)}&` : '?';
    const link = `${ctx.request.protocol}://${ctx.request.host}${ctx.request.path}${serializedQuery}`;

    const AuthService = await getAuthService();
    let users;

    if (query.app === 'all') {
        users = await AuthService.getUsers(null, omit(query, ['app']));
    } else if (query.app) {
        users = await AuthService.getUsers(query.app.split(','), omit(query, ['app']));
    } else {
        users = await AuthService.getUsers(apps, query);
    }

    ctx.body = UserSerializer.serialize(users, link);
}

async function getCurrentUser(ctx) {
    const requestUser = Utils.getUser(ctx);

    logger.info('Get current user: ', requestUser.id);

    const AuthService = await getAuthService();
    const user = await AuthService.getUserById(requestUser.id);

    if (!user) {
        ctx.throw(404, 'User not found');
        return;
    }
    ctx.body = user;
}

async function getUserById(ctx) {
    logger.info('Get User by id: ', ctx.params.id);

    const AuthService = await getAuthService();
    const user = await AuthService.getUserById(ctx.params.id);

    if (!user) {
        ctx.throw(404, 'User not found');
        return;
    }
    ctx.body = user;
}

async function findByIds(ctx) {
    logger.info('Find by ids');
    ctx.assert(ctx.request.body.ids, 400, 'Ids objects required');
    const AuthService = await getAuthService();
    const data = await AuthService.getUsersByIds(ctx.request.body.ids);
    ctx.body = {
        data
    };
}

async function getIdsByRole(ctx) {
    logger.info(`[getIdsByRole] Get ids by role: ${ctx.params.role}`);
    const AuthService = await getAuthService();
    const data = await AuthService.getIdsByRole(ctx.params.role);
    ctx.body = {
        data
    };
}

async function updateUser(ctx) {
    logger.info(`Update user with id ${ctx.params.id}`);
    ctx.assert(ctx.params.id, 'Id param required');

    const user = Utils.getUser(ctx);
    const AuthService = await getAuthService();
    const userUpdate = await AuthService.updateUser(ctx.params.id, ctx.request.body, user);
    if (!userUpdate) {
        ctx.throw(404, 'User not found');
        return;
    }
    ctx.body = UserSerializer.serialize(userUpdate);
}

async function updateMe(ctx) {
    logger.info(`Update user me`);

    const user = Utils.getUser(ctx);
    const AuthService = await getAuthService();
    const userUpdate = await AuthService.updateUser(user.id, ctx.request.body, user);
    if (!userUpdate) {
        ctx.throw(404, 'User not found');
        return;
    }
    ctx.body = UserSerializer.serialize(userUpdate);
}

async function deleteUser(ctx) {
    logger.info(`Delete user with id ${ctx.params.id}`);
    ctx.assert(ctx.params.id, 'Id param required');

    const AuthService = await getAuthService();
    const deletedUser = await AuthService.deleteUser(ctx.params.id);
    if (!deletedUser) {
        ctx.throw(404, 'User not found');
        return;
    }
    ctx.body = UserSerializer.serialize(deletedUser);
}

async function createUser(ctx) {
    logger.info(`Create user with body ${ctx.request.body}`);
    const { body } = ctx.request;
    const user = Utils.getUser(ctx);
    if (!user) {
        ctx.throw(401, 'Not logged');
        return;
    }

    if (user.role === 'MANAGER' && body.role === 'ADMIN') {
        logger.info('User is manager but the new user is admin');
        ctx.throw(403, 'Forbidden');
        return;
    }

    if (!body.extraUserData || !body.extraUserData.apps) {
        logger.info('Not send apps');
        ctx.throw(400, 'Apps required');
        return;
    }
    if (!user.extraUserData || !user.extraUserData.apps) {
        logger.info('logged user does not contain apps');
        ctx.throw(403, 'Forbidden');
        return;
    }

    const AuthService = await getAuthService();
    const exist = await AuthService.existEmail(body.email);
    if (exist) {
        ctx.throw(400, 'Email exists');
        return;
    }

    // check Apps
    for (let i = 0, { length } = body.extraUserData.apps; i < length; i += 1) {
        if (user.extraUserData.apps.indexOf(body.extraUserData.apps[i]) < 0) {
            ctx.throw(403, 'Forbidden');
            return;
        }
    }

    await AuthService.createUserWithoutPassword(ctx.request.body, ctx.state.generalConfig);
    ctx.body = {};

}

async function success(ctx) {
    if (ctx.session.callbackUrl) {
        logger.info('Url redirect', ctx.session.callbackUrl);

        // Removing "#_=_", added by FB to the return callbacks to the frontend :scream:
        ctx.session.callbackUrl = ctx.session.callbackUrl.replace('#_=_', '');

        if (ctx.session.generateToken) {
            // generate token and eliminate session
            const token = await createToken(ctx, false);

            // Replace token query parameter in redirect URL
            const url = new URL(ctx.session.callbackUrl);
            const { searchParams } = url;
            searchParams.set('token', token);
            url.search = searchParams.toString();

            // Perform redirect
            ctx.redirect(url.toString());
        } else {
            ctx.redirect(ctx.session.callbackUrl);
        }
        ctx.session.callbackUrl = null;
        ctx.session.generateToken = null;
        return;
    }
    ctx.session.callbackUrl = null;
    ctx.session.generateToken = null;
    await ctx.render('login-correct', {
        error: false,
        generalConfig: ctx.state.generalConfig,
    });
}

async function failAuth(ctx) {
    logger.info('Not authenticated');
    const plugin = await Plugin.findOne({ name: 'oauth' });
    const originApp = Utils.getOriginApp(ctx, plugin);
    const appConfig = plugin.config.thirdParty[originApp];

    const thirdParty = {
        twitter: false,
        google: false,
        facebook: false,
        basic: false
    };

    if (appConfig.twitter && appConfig.twitter.active) {
        thirdParty.twitter = appConfig.twitter.active;
    }

    if (appConfig.google && appConfig.google.active) {
        thirdParty.google = appConfig.google.active;
    }

    if (appConfig.facebook && appConfig.facebook.active) {
        thirdParty.facebook = appConfig.facebook.active;
    }

    if (plugin.config.basic && plugin.config.basic.active) {
        thirdParty.basic = plugin.config.basic.active;
    }

    const { allowPublicRegistration } = plugin.config;
    if (ctx.query.error) {
        await ctx.render('login', {
            error: true,
            thirdParty,
            generalConfig: ctx.state.generalConfig,
            allowPublicRegistration
        });
    } else {
        ctx.throw(401, 'Not authenticated');
    }
}

async function logout(ctx) {
    ctx.logout();
    ctx.redirect('/auth/login');
}

async function signUp(ctx) {
    logger.info('Creating user');
    let error = null;
    if (!ctx.request.body.email || !ctx.request.body.password || !ctx.request.body.repeatPassword) {
        error = 'Email, Password and Repeat password are required';
    }
    if (ctx.request.body.password !== ctx.request.body.repeatPassword) {
        error = 'Password and Repeat password not equal';
    }

    const AuthService = await getAuthService();
    const exist = await AuthService.existEmail(ctx.request.body.email);
    if (exist) {
        error = 'Email exists';
    }
    if (error) {
        if (ctx.request.type === 'application/json') {
            throw new UnprocessableEntityError(error);
        } else {
            await ctx.render('sign-up', {
                error,
                email: ctx.request.body.email,
                generalConfig: ctx.state.generalConfig,
            });

        }
        return;
    }

    try {
        const data = await AuthService.createUser(ctx.request.body, ctx.state.generalConfig);
        if (ctx.request.type === 'application/json') {
            ctx.response.type = 'application/json';
            ctx.body = UserTempSerializer.serialize(data);
        } else {
            await ctx.render('sign-up-correct', {
                generalConfig: ctx.state.generalConfig,
            });
        }
    } catch (err) {
        logger.info('Error', err);
        await ctx.render('sign-up', {
            error: 'Error creating user.',
            email: ctx.request.body.email,
            generalConfig: ctx.state.generalConfig,
        });
    }
}

async function getSignUp(ctx) {
    await ctx.render('sign-up', {
        error: null,
        email: null,
        generalConfig: ctx.state.generalConfig,
    });
}

async function confirmUser(ctx) {
    logger.info('Confirming user');
    const AuthService = await getAuthService();
    const user = await AuthService.confirmUser(ctx.params.token);
    if (!user) {
        ctx.throw(400, 'User expired or token not found');
        return;
    }
    if (ctx.query.callbackUrl) {
        ctx.redirect(ctx.query.callbackUrl);
        return;
    }

    const userFirstApp = (user && user.extraUserData && user.extraUserData.apps && user.extraUserData.apps.length > 0) ? user.extraUserData.apps[0] : null;

    const plugin = await Plugin.findOne({ name: 'oauth' });
    if (userFirstApp && plugin.config.local[userFirstApp] && plugin.config.local[userFirstApp].confirmUrlRedirect) {
        ctx.redirect(plugin.config.local[userFirstApp].confirmUrlRedirect);
        return;
    }

    if (plugin.config.local.confirmUrlRedirect) {
        ctx.redirect(plugin.config.local.confirmUrlRedirect);
        return;
    }
    ctx.body = UserSerializer.serialize(user);
}

async function loginView(ctx) {
    // check if the user has session
    const user = Utils.getUser(ctx);
    if (user) {
        logger.info('User has session');

        if (ctx.request.type === 'application/json') {
            ctx.status = 200;
            return;
        }

        ctx.redirect('/auth/success');
        return;
    }
    if (!user && ctx.request.type === 'application/json') {
        throw new UnauthorizedError('Not logged in');
    }

    const plugin = await Plugin.findOne({ name: 'oauth' });
    const originApp = Utils.getOriginApp(ctx, plugin);
    const thirdParty = {
        twitter: false,
        google: false,
        facebook: false,
        basic: false
    };

    if (plugin.config.thirdParty && plugin.config.thirdParty[originApp] && plugin.config.thirdParty[originApp].twitter && plugin.config.thirdParty[originApp].twitter.active) {
        thirdParty.twitter = plugin.config.thirdParty[originApp].twitter.active;
    }

    if (plugin.config.thirdParty && plugin.config.thirdParty[originApp] && plugin.config.thirdParty[originApp].google && plugin.config.thirdParty[originApp].google.active) {
        thirdParty.google = plugin.config.thirdParty[originApp].google.active;
    }

    if (plugin.config.thirdParty && plugin.config.thirdParty[originApp] && plugin.config.thirdParty[originApp].facebook && plugin.config.thirdParty[originApp].facebook.active) {
        thirdParty.facebook = plugin.config.thirdParty[originApp].facebook.active;
    }

    if (plugin.config.basic && plugin.config.basic.active) {
        thirdParty.basic = plugin.config.basic.active;
    }

    const { allowPublicRegistration } = plugin.config;
    logger.info(thirdParty);
    await ctx.render('login', {
        error: false,
        thirdParty,
        generalConfig: ctx.state.generalConfig,
        allowPublicRegistration
    });
}

async function requestEmailResetView(ctx) {
    const plugin = await Plugin.findOne({ name: 'oauth' });
    await ctx.render('request-mail-reset', {
        error: null,
        info: null,
        email: null,
        app: Utils.getOriginApp(ctx, plugin),
        generalConfig: ctx.state.generalConfig,
    });
}

async function redirectLogin(ctx) {
    ctx.redirect('/auth/login');
}

async function resetPasswordView(ctx) {
    const AuthService = await getAuthService();
    const renew = await AuthService.getRenewModel(ctx.params.token);
    let error = null;
    if (!renew) {
        error = 'Token expired';
    }

    const plugin = await Plugin.findOne({ name: 'oauth' });
    await ctx.render('reset-password', {
        error,
        app: Utils.getOriginApp(ctx, plugin),
        token: renew ? renew.token : null,
        generalConfig: ctx.state.generalConfig,
    });
}

async function sendResetMail(ctx) {
    logger.info('Send reset mail');
    const plugin = await Plugin.findOne({ name: 'oauth' });

    if (!ctx.request.body.email) {
        if (ctx.request.type === 'application/json') {
            throw new UnprocessableEntityError('Mail required');
        } else {
            await ctx.render('request-mail-reset', {
                error: 'Mail required',
                info: null,
                email: ctx.request.body.email,
                app: Utils.getOriginApp(ctx, plugin),
                generalConfig: ctx.state.generalConfig,
            });

            return;
        }
    }

    const originApp = Utils.getOriginApp(ctx, plugin);

    const AuthService = await getAuthService();
    const renew = await AuthService.sendResetMail(ctx.request.body.email, ctx.state.generalConfig, originApp);
    if (!renew) {
        if (ctx.request.type === 'application/json') {
            throw new UnprocessableEntityError('User not found');
        } else {
            await ctx.render('request-mail-reset', {
                error: 'User not found',
                info: null,
                email: ctx.request.body.email,
                app: Utils.getOriginApp(ctx, plugin),
                generalConfig: ctx.state.generalConfig,
            });

            return;
        }
    }

    if (ctx.request.type === 'application/json') {
        ctx.body = { message: 'Email sent' };
    } else {
        await ctx.render('request-mail-reset', {
            info: 'Email sent!!',
            error: null,
            email: ctx.request.body.email,
            app: Utils.getOriginApp(ctx, plugin),
            generalConfig: ctx.state.generalConfig,
        });
    }
}

async function updateApplications(ctx) {
    try {
        if (ctx.session && ctx.session.applications) {
            let user = Utils.getUser(ctx);
            const AuthService = await getAuthService();
            if (user.role === 'USER') {
                user = await AuthService.updateApplicationsUser(user.id, ctx.session.applications);
            } else {
                user = await AuthService.getUserById(user.id);
            }
            delete ctx.session.applications;
            if (user) {
                ctx.login({
                    id: user._id,
                    provider: user.provider,
                    providerId: user.providerId,
                    role: user.role,
                    createdAt: user.createdAt,
                    extraUserData: user.extraUserData,
                    email: user.email,
                    photo: user.photo,
                    name: user.name
                });
            }
        }
        ctx.redirect('/auth/success');
    } catch (err) {
        logger.info(err);
        ctx.redirect('/auth/fail');
    }

}

async function resetPassword(ctx) {
    logger.info('Resetting password');
    const plugin = await Plugin.findOne({ name: 'oauth' });

    let error = null;
    if (!ctx.request.body.password || !ctx.request.body.repeatPassword) {
        error = 'Password and Repeat password are required';
    }
    if (ctx.request.body.password !== ctx.request.body.repeatPassword) {
        error = 'Password and Repeat password not equal';
    }
    const AuthService = await getAuthService();
    const exist = await AuthService.getRenewModel(ctx.params.token);
    if (!exist) {
        error = 'Token expired';
    }
    if (error) {
        if (ctx.request.type === 'application/json') {
            throw new UnprocessableEntityError(error);
        } else {
            await ctx.render('reset-password', {
                error,
                app: Utils.getOriginApp(ctx, plugin),
                token: ctx.params.token,
                generalConfig: ctx.state.generalConfig,
            });
        }

        return;
    }
    const user = await AuthService.updatePassword(ctx.params.token, ctx.request.body.password);
    if (user) {
        if (ctx.request.type === 'application/json') {
            ctx.response.type = 'application/json';
            ctx.body = UserTempSerializer.serialize(user);
        } else {
            const app = Utils.getOriginApp(ctx, plugin);
            const applicationConfig = plugin.config.applications && plugin.config.applications[app];

            if (applicationConfig && applicationConfig.confirmUrlRedirect) {
                ctx.redirect(applicationConfig.confirmUrlRedirect);
                return;
            }
            if (plugin.config.local.confirmUrlRedirect) {
                ctx.redirect(plugin.config.local.confirmUrlRedirect);
                return;
            }
            ctx.body = user;
        }
    } else {
        await ctx.render('reset-password', {
            app: Utils.getOriginApp(ctx, plugin),
            error: 'Error updating user',
            token: ctx.params.token,
            generalConfig: ctx.state.generalConfig,
        });
    }
}

module.exports = {
    twitter,
    twitterCallback,
    google,
    googleToken,
    googleCallback,
    facebook,
    facebookToken,
    facebookCallback,
    localCallback,
    failAuth,
    checkLogged,
    success,
    logout,
    generateJWT,
    getUsers,
    getCurrentUser,
    getUserById,
    findByIds,
    getIdsByRole,
    createUser,
    updateUser,
    deleteUser,
    updateMe,
    signUp,
    confirmUser,
    getSignUp,
    loginView,
    redirectLogin,
    resetPasswordView,
    requestEmailResetView,
    resetPassword,
    sendResetMail,
    updateApplications
};
