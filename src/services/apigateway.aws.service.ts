import {
    APIGatewayClient,
    CreateApiKeyCommand,
    CreateApiKeyCommandInput,
    CreateApiKeyCommandOutput,
    CreateUsagePlanKeyCommand,
    CreateUsagePlanKeyCommandInput, CreateUsagePlanKeyCommandOutput,
    DeleteApiKeyCommand,
    DeleteApiKeyCommandOutput,
    PatchOperation,
    UpdateApiKeyCommand,
    UpdateApiKeyCommandOutput
} from "@aws-sdk/client-api-gateway";
import config = require('config');
import MissingRegionError from "errors/missingRegion.error";
import { APIGatewayClientConfig } from "@aws-sdk/client-api-gateway/dist-types/APIGatewayClient";
import logger from 'logger';

class APIGatewayAWSService {
    private static client: APIGatewayClient;

    private static init(): void {
        if (APIGatewayAWSService.client) {
            return;
        }

        const region: string = config.get('aws.region');
        if (region === null) {
            throw new MissingRegionError();
        }

        const clientConfig: APIGatewayClientConfig = { region: config.get('aws.region') }
        if (config.get('aws.accessKeyId') !== null && config.get('aws.secretAccessKey') !== null) {
            clientConfig.credentials = {
                accessKeyId: config.get('aws.accessKeyId'),
                secretAccessKey: config.get('aws.secretAccessKey')
            }
        }

        APIGatewayAWSService.client = new APIGatewayClient(clientConfig);
    }

    static async createApiKey(name: string): Promise<CreateApiKeyCommandOutput> {
        if ((config.get('aws.apiKeyUsagePlanId') as string).length === 0) {
            throw new Error('API Gateway usage plan ID not set');
        }

        APIGatewayAWSService.init();
        let createApiKeyCommandResponse: CreateApiKeyCommandOutput;

        const createApiKeyCommandParams: CreateApiKeyCommandInput = {
            name,
            enabled: true,
            value: Math.random().toString(36).substring(32),
        };
        const createApiKeyCommand: CreateApiKeyCommand = new CreateApiKeyCommand(createApiKeyCommandParams);

        try {
            createApiKeyCommandResponse = await this.client.send(createApiKeyCommand);

            const createUsagePlanKeyParams: CreateUsagePlanKeyCommandInput = {
                usagePlanId: config.get('aws.apiKeyUsagePlanId'),
                keyType: 'API_KEY',
                keyId: createApiKeyCommandResponse.id,
            };
            const createUsagePlanKeyCommand: CreateUsagePlanKeyCommand = new CreateUsagePlanKeyCommand(createUsagePlanKeyParams);
            await this.client.send(createUsagePlanKeyCommand);

            return createApiKeyCommandResponse;
        } catch (apiKeyCreationError) {
            logger.error(`[APIGatewayAWSService] - Error creating API key: ${apiKeyCreationError.toString()}`)
            if (createApiKeyCommandResponse) {
                logger.error(`[APIGatewayAWSService] - Deleting API key: ${createApiKeyCommandResponse.id}`)
                try {
                    await this.deleteApiKey(createApiKeyCommandResponse.id);
                } catch (apiKeyDeletionError) {
                    logger.error(`[APIGatewayAWSService] - Error deleting API key following failed API key creation: ${apiKeyDeletionError.toString()}`)
                }
            }
            throw apiKeyCreationError;
        }
    }

    static async updateApiKey(apiKeyId: string, name: string): Promise<UpdateApiKeyCommandOutput> {
        APIGatewayAWSService.init();

        const patchOperations: PatchOperation[] = [];

        if (name) {
            patchOperations.push({
                op: 'replace',
                path: '/name',
                value: name
            });
        }

        const command: UpdateApiKeyCommand = new UpdateApiKeyCommand({
            apiKey: apiKeyId,
            patchOperations
        });

        try {
            const data: UpdateApiKeyCommandOutput = await this.client.send(command);
            return data;
        } catch (error) {
            logger.error(`[APIGatewayAWSService] - Error updating API key: ${error}`)
            throw error;
        }
    }

    static async deleteApiKey(apiKeyId: string): Promise<DeleteApiKeyCommandOutput> {
        APIGatewayAWSService.init();

        const command: DeleteApiKeyCommand = new DeleteApiKeyCommand({
            apiKey: apiKeyId,
        });

        try {
            const data: DeleteApiKeyCommandOutput = await this.client.send(command);
            return data;
        } catch (error) {
            logger.error(`[APIGatewayAWSService] - Error deleting API key: ${error}`)
            throw error;
        }
    }
}

export default APIGatewayAWSService;
