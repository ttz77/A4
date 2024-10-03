import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

/**
 * Document interface for participation records.
 */
export interface ParticipationDoc extends BaseDoc {
  userID: ObjectId;
  activityID: ObjectId;
}

/**
 * Concept: Joining
 */
export default class JoiningConcept {
  public readonly participations: DocCollection<ParticipationDoc>;

  /**
   * Create an instance of JoiningConcept.
   */
  constructor(collectionName: string) {
    this.participations = new DocCollection<ParticipationDoc>(collectionName);

    // Create index on activityID to improve query performance.
    void this.participations.collection.createIndex({ activityID: 1 });

    // Create a compound unique index to prevent duplicate participations.
    void this.participations.collection.createIndex(
      { userID: 1, activityID: 1 },
      { unique: true }
    );
  }

  /**
   * Allow a user to join an activity.
   */
  async joinActivity(userID: ObjectId, activityID: ObjectId) {
    const existingParticipation = await this.participations.readOne({ userID, activityID });
    if (existingParticipation) {
      throw new NotAllowedError("User has already joined this activity.");
    }
    await this.participations.createOne({ userID, activityID });
    return { msg: "Successfully joined the activity." };
  }

  /**
   * Allow a user to leave an activity.
   */
  async leaveActivity(userID: ObjectId, activityID: ObjectId) {
    const result = await this.participations.deleteOne({ userID, activityID });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Participation record not found.");
    }
    return { msg: "Successfully left the activity." };
  }

  /**
   * Get all participants of an activity.
   */
  async getParticipants(activityID: ObjectId) {
    const participations = await this.participations.readMany({ activityID });
    const userIDs = participations.map((participation) => participation.userID);
    return userIDs;
  }

  /**
   * Get all activities a user has joined.
   */
  async getActivitiesForUser(userID: ObjectId) {
    const participations = await this.participations.readMany({ userID });
    const activityIDs = participations.map((participation) => participation.activityID);
    return activityIDs;
  }

  /**
   * Check if a user has joined a specific activity.
   */
  async isUserParticipant(userID: ObjectId, activityID: ObjectId) {
    const participation = await this.participations.readOne({ userID, activityID });
    return participation !== null;
  }
}
