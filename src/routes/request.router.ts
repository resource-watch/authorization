import { Context } from 'koa';
import router, { Router, Config } from 'koa-joi-router';
import logger from 'logger';
import Utils from 'utils';
import jwt from 'jsonwebtoken';
import { IUser, JWTPayload } from "services/okta.interfaces";
import UserSerializer from "serializers/user.serializer";
import { UserModelStub } from "models/user.model.stub";
import OktaService from "services/okta.service";
import Settings from "services/settings.service";
import { IApplication } from "models/application";
import ApplicationService from "services/application.service";
import ApplicationSerializer from "serializers/application.serializer";

const requestRouter: Router = router();
requestRouter.prefix('/api/v1/request');

const Joi: typeof router.Joi = router.Joi;

const validateRequestValidation: Config["validate"] = {
    type: 'json',
    header: Joi.object({
        authorization: Joi.string().required(),
    }).unknown(true),
    body: Joi.object({
        userToken: Joi.string().required(),
        apiKey: Joi.string().optional(),
    })
};


class RequestRouter {
    static async validateRequest(ctx: Context): Promise<void> {
        const { userToken, apiKey } = ctx.request.body;
        logger.debug(`[RequestRouter] Validating userToken: ${userToken} and apiKey ${apiKey ? apiKey : '<not provided>'}`);
        let decodedUserToken: JWTPayload
        try {
            decodedUserToken = (jwt.verify(userToken, Settings.getSettings().jwt.secret) as JWTPayload);
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                ctx.throw(401, 'Invalid userToken');
            } else {
                ctx.throw(500, 'Internal server error validating userToken');
            }
            return;
        }

        const isRevoked: boolean = await OktaService.checkRevokedToken(ctx, decodedUserToken);
        if (isRevoked) {
            ctx.throw(401, 'Token revoked');
            return;
        }

        const user: IUser = await OktaService.getUserById(decodedUserToken.id);
        if (!user) {
            ctx.throw(404, 'User not found');
            return;
        }
        const serializedUser: Record<string, any> = await UserSerializer.serialize(await UserModelStub.hydrate(user));

        const response: { user: Record<string, any>, application?: Record<string, any> } = {
            user: serializedUser
        };

        if (apiKey) {
            const application: IApplication = await ApplicationService.getApplicationByApiKey(apiKey);

            response.application = ApplicationSerializer.serialize(await application.hydrate());
        }

        ctx.body = response
    }
}

requestRouter.route({
    method: 'post',
    path: '/validate',
    validate: validateRequestValidation,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pre: Utils.isMicroservice, handler: RequestRouter.validateRequest,
});

export default requestRouter;
