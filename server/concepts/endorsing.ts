// endorsing.ts

import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError, NotAllowedError } from "./errors";

/**
 * Document interface for an endorsement.
 */
export interface EndorsementDoc extends BaseDoc {
  endorserID: ObjectId;
  endorsedID: ObjectId;
  skill: string;
}

/**
 * Concept: Endorsing
 */
export default class EndorsingConcept {
  public readonly endorsements: DocCollection<EndorsementDoc>;

  /**
   * Create an instance of EndorsingConcept.
   */
  constructor(collectionName: string) {
    this.endorsements = new DocCollection<EndorsementDoc>(collectionName);

    // Create an index to prevent duplicate endorsements for the same skill between two users
    void this.endorsements.collection.createIndex(
      { endorserID: 1, endorsedID: 1, skill: 1 },
      { unique: true }
    );
  }

  /**
   * Endorse a user for a specific skill.
   */
  async endorseUser(endorserID: ObjectId, endorsedID: ObjectId, skill: string) {
    if (endorserID.equals(endorsedID)) {
      throw new NotAllowedError("You cannot endorse yourself.");
    }

    await this.endorsements.createOne({ endorserID, endorsedID, skill });
    return { msg: "Endorsement added successfully." };
  }

  /**
   * Remove an endorsement.
   */
  async removeEndorsement(endorserID: ObjectId, endorsedID: ObjectId, skill: string) {
    const result = await this.endorsements.deleteOne({ endorserID, endorsedID, skill });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Endorsement not found.");
    }
    return { msg: "Endorsement removed successfully." };
  }

  /**
   * Get endorsements received by a user.
   */
  async getReceivedEndorsements(endorsedID: ObjectId) {
    return await this.endorsements.readMany({ endorsedID });
  }

  /**
   * Get endorsements given by a user.
   */
  async getGivenEndorsements(endorserID: ObjectId) {
    return await this.endorsements.readMany({ endorserID });
  }

  /**
   * Get skills endorsed for a user.
   */
  async getEndorsedSkills(endorsedID: ObjectId) {
    const endorsements = await this.endorsements.readMany({ endorsedID });
    const skills: { [skill: string]: number } = {};
    endorsements.forEach((endorsement) => {
      skills[endorsement.skill] = (skills[endorsement.skill] || 0) + 1;
    });
    return skills;
  }
}
