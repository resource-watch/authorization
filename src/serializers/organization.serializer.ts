import { Serializer } from 'jsonapi-serializer';
import { IOrganization } from 'models/organization';
import { AggregatePaginateResult, PaginateDocument, PaginateOptions, PaginateResult } from 'mongoose';
import { IApplication } from "models/application";
import { IOrganizationUser } from "models/organization-user";

const organizationSerializer: Serializer = new Serializer('organization', {
    attributes: [
        'name',
        'applications',
        'users',
        'createdAt',
        'updatedAt',
    ],
    id: '_id',
    keyForAttribute: 'camelCase',
    transform: ((organization: IOrganization): Record<string, any> => ({
        ...organization.toObject(),
        applications: organization.applications ? organization.applications.map((application: IApplication) => ({
            id: application._id.toString(),
            name: application.name
        })) : [],
        users: organization.users ? organization.users.map((organizationUser: IOrganizationUser) => ({
            id: organizationUser.user.id.toString(),
            name: organizationUser.user.name,
            role: organizationUser.role
        })) : []
    }))
});

export interface SerializedOrganizationResponse {
    data: {
        id: string,
        type: 'organization',
        attributes: IOrganization
    };
    links: {
        self: string,
        first: string,
        last: string,
        prev: string,
        next: string,
    };
    meta: {
        'total-pages': number,
        'total-items': number
        size: number
    };
}

class OrganizationSerializer {

    static serializeList(data: AggregatePaginateResult<IOrganization>, link: string): SerializedOrganizationResponse {
        const serializedData: SerializedOrganizationResponse = organizationSerializer.serialize(data.docs);

        serializedData.links = {
            self: `${link}page[number]=${data.page}&page[size]=${data.limit}`,
            first: `${link}page[number]=1&page[size]=${data.limit}`,
            last: `${link}page[number]=${data.totalPages}&page[size]=${data.limit}`,
            prev: `${link}page[number]=${data.page - 1 > 0 ? data.page - 1 : data.page}&page[size]=${data.limit}`,
            next: `${link}page[number]=${data.page + 1 < data.totalPages ? data.page + 1 : data.totalPages}&page[size]=${data.limit}`,
        };

        serializedData.meta = {
            'total-pages': data.totalPages as number,
            'total-items': data.totalDocs as number,
            size: data.limit
        };

        return serializedData;
    }

    static serialize(data: Record<string, any>): SerializedOrganizationResponse {
        return organizationSerializer.serialize(data);
    }

}

export default OrganizationSerializer;
