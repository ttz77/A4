// verifying.ts

import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

/**
 * Interface representing the data submitted for verification.
 */
export interface VerificationData {
  method: "government_id";
  data: string; // Specific data depending on the method used.
}

/**
 * Possible verification statuses.
 */
export type VerificationStatus = "verified" | "unverified" | "pending";

/**
 * Document interface for verification records.
 */
export interface VerificationDoc extends BaseDoc {
  userID: ObjectId;
  verificationData: VerificationData;
  status: VerificationStatus;
}

/**
 * Concept: VerifyingIdentity
 */
export default class VerifyingIdentityConcept {
  public readonly verifications: DocCollection<VerificationDoc>;

  /**
   * Create an instance of VerifyingIdentityConcept.
   */
  constructor(collectionName: string) {
    this.verifications = new DocCollection<VerificationDoc>(collectionName);

    // Create unique index on userID to prevent duplicate verification records for the same user.
    void this.verifications.collection.createIndex({ userID: 1 }, { unique: true });
  }

  /**
   * Submit verification data for a user.
   */
  async submitVerification(userID: ObjectId, verificationData: VerificationData) {
    // Ensure that the method is "government_id"
    if (verificationData.method !== "government_id") {
      throw new NotAllowedError("Invalid verification method. Only 'government_id' is allowed.");
    }

    const existingVerification = await this.verifications.readOne({ userID });
    if (existingVerification) {
      if (
        existingVerification.status === "verified" ||
        existingVerification.status === "pending"
      ) {
        throw new NotAllowedError("Verification already submitted or approved.");
      } else {
        // If status is 'unverified', allow resubmission.
        await this.verifications.partialUpdateOne(
          { userID },
          { verificationData, status: "pending" }
        );
      }
    } else {
      // Create a new verification record.
      await this.verifications.createOne({ userID, verificationData, status: "pending" });
    }
    return { msg: "Verification submitted successfully." };
  }

  /**
   * Approve a user's verification.
   */
  async approveVerification(userID: ObjectId) {
    const verification = await this.verifications.readOne({ userID });
    if (!verification) {
      throw new NotFoundError("Verification record not found.");
    }
    await this.verifications.partialUpdateOne({ userID }, { status: "verified" });
    return { msg: "Verification approved successfully." };
  }

  /**
   * Reject a user's verification.
   */
  async rejectVerification(userID: ObjectId) {
    const verification = await this.verifications.readOne({ userID });
    if (!verification) {
      throw new NotFoundError("Verification record not found.");
    }
    await this.verifications.partialUpdateOne({ userID }, { status: "unverified" });
    return { msg: "Verification rejected." };
  }

  /**
   * Get the verification status of a user.
   */
  async getVerificationStatus(userID: ObjectId) {
    const verification = await this.verifications.readOne({ userID });
    if (!verification) {
      // Users without a verification record are considered 'unverified'.
      return { status: "unverified" as VerificationStatus };
    }
    return { status: verification.status };
  }

  /**
   * Assert that a user is verified.
   */
  async assertUserVerified(userID: ObjectId) {
    const statusResult = await this.getVerificationStatus(userID);
    if (statusResult.status !== "verified") {
      throw new NotAllowedError("User is not verified.");
    }
  }
}
