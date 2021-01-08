import { Context, Next } from "koa";
import { RouterContext } from "koa-router";
import passport from "koa-passport";
import logger from "logger";
import Utils from "utils";
import UserService from "services/user.service";
import Settings, { IThirdPartyAuth } from "services/settings.service";
import { UserDocument } from "models/user.model";
import { Strategy } from "passport";
import { IStrategyOption, Strategy as TwitterStrategy } from "passport-twitter";
import BaseProvider from "providers/base.provider";

export class TwitterProvider extends BaseProvider {

    static async registerUserBasicTwitter(
        accessToken: string,
        refreshToken: string,
        profile: Record<string, any>,
        done: (error: any, user?: any, message?: any) => void
    ): Promise<void> {
        logger.info('[TwitterProvider] Registering user', profile);

        const user: UserDocument = await UserService.getUser({
            provider: 'twitter',
            providerId: profile.id,
        });

        logger.info(user);

        if (!user) {
            done(null, false, { message: 'No RW API user found for this Twitter account' });
        } else {
            let email: string = null;
            if (profile?.emails?.length > 0) {
                email = profile.emails[0].value;
            }
            if (email && email !== user.email) {
                logger.info('[TwitterProvider] Updating email');
                user.email = email;
                await user.save();
            }
        }
        logger.info('[TwitterProvider] Returning user');
        done(null, {
            id: user._id,
            provider: user.provider,
            providerId: user.providerId,
            role: user.role,
            createdAt: user.createdAt,
            extraUserData: user.extraUserData,
            name: user.name,
            photo: user.photo,
            email: user.email
        });
    }


    static registerStrategies(): void {
        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((user, done) => {
            done(null, user);
        });

        if (Settings.getSettings().thirdParty) {
            logger.info('[TwitterProvider] Loading Twitter auth');
            const apps: string[] = Object.keys(Settings.getSettings().thirdParty);
            for (let i: number = 0, { length } = apps; i < length; i += 1) {
                logger.info(`[TwitterProvider] Loading Twitter auth settings for ${apps[i]}`);
                const app: IThirdPartyAuth = Settings.getSettings().thirdParty[apps[i]];
                if (app.twitter?.active) {
                    logger.info(`[TwitterProvider] Loading Twitter auth passport provider for ${apps[i]}`);
                    const configTwitter: IStrategyOption = {
                        consumerKey: app.twitter.consumerKey,
                        consumerSecret: app.twitter.consumerSecret,
                        userProfileURL: 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
                        callbackURL: `${Settings.getSettings().publicUrl}/auth/twitter/callback`
                    };
                    const twitterStrategy: Strategy = new TwitterStrategy(configTwitter, this.registerUserBasicTwitter);
                    twitterStrategy.name += `:${apps[i]}`;
                    passport.use(twitterStrategy);
                }
            }
        }
    }


    static async twitter(ctx: Context & RouterContext, next: Next): Promise<void> {
        const app: string = Utils.getOriginApp(ctx);
        await passport.authenticate(`twitter:${app}`)(ctx, next);
    }

    static async twitterCallback(ctx: Context & RouterContext, next: Next): Promise<void> {
        const app: string = Utils.getOriginApp(ctx);
        await passport.authenticate(`twitter:${app}`, {
            failureRedirect: '/auth/fail',
        })(ctx, next);
    }
}

export default TwitterProvider;
