import DeletionModel, { IDeletion } from 'models/deletion';
import { FilterQuery, PaginateDocument, PaginateOptions, PaginateResult } from 'mongoose';
import DeletionNotFoundError from 'errors/deletionNotFound.error';
import { IUserLegacyId } from "services/okta.interfaces";

export default class DeletionService {
    static async createDeletion(deletionData: Partial<IDeletion>): Promise<IDeletion> {
        const deletion: Partial<IDeletion> = new DeletionModel(deletionData);
        return deletion.save();
    }

    static async updateDeletion(id: string, deletionData: Partial<IDeletion>): Promise<IDeletion> {
        const deletion: IDeletion = await DeletionService.getDeletionById(id);

        deletion.set(deletionData);
        deletion.updatedAt = new Date();

        return deletion.save();
    }

    static async deleteDeletion(id: string): Promise<IDeletion> {
        const deletion: IDeletion = await DeletionService.getDeletionById(id);

        await deletion.deleteOne();

        return deletion;
    }

    static async getDeletions(query: FilterQuery<IDeletion>, paginationOptions: PaginateOptions): Promise<PaginateResult<PaginateDocument<IDeletion, unknown, PaginateOptions>>> {
        const deletions: PaginateResult<PaginateDocument<IDeletion, unknown, PaginateOptions>> = await DeletionModel.paginate(query, paginationOptions);
        return deletions;
    }

    static async getDeletionById(id: string): Promise<IDeletion> {
        const deletion: IDeletion = await DeletionModel.findById(id.toString());
        if (!deletion) {
            throw new DeletionNotFoundError();
        }
        return deletion;
    }

    static async getDeletionByUserId(userId: IUserLegacyId): Promise<IDeletion> {
        const deletion: IDeletion = await DeletionModel.findOne({ userId });
        if (!deletion) {
            throw new DeletionNotFoundError();
        }
        return deletion;
    }
}
