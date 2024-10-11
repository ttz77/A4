// locationsharing.ts

import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

/**
 * Represents a trusted contact's identifier.
 */
export type Contact = ObjectId;

/**
 * Represents geographical coordinates.
 */
export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Document interface for location sharing.
 */
export interface LocationDoc extends BaseDoc {
  userID: ObjectId;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

/**
 * Document interface for location sharing status.
 */
export interface LocationSharingStatusDoc extends BaseDoc {
  userID: ObjectId;
  enabled: boolean;
}

/**
 * Document interface for trusted contacts.
 */
export interface TrustedContactsDoc extends BaseDoc {
  userID: ObjectId;
  contacts: Contact[];
}

/**
 * Concept: LocationSharing
 */
export default class LocationSharingConcept {
  public readonly locations: DocCollection<LocationDoc>;
  public readonly sharingStatus: DocCollection<LocationSharingStatusDoc>;
  public readonly trustedContacts: DocCollection<TrustedContactsDoc>;

  /**
   * Create an instance of LocationSharingConcept.
   */
  constructor(collectionName: string) {
    this.locations = new DocCollection<LocationDoc>(`${collectionName}_locations`);
    this.sharingStatus = new DocCollection<LocationSharingStatusDoc>(`${collectionName}_status`);
    this.trustedContacts = new DocCollection<TrustedContactsDoc>(`${collectionName}_trusted_contacts`);

    // Create indexes for quick retrieval
    void this.locations.collection.createIndex({ userID: 1 });
    void this.sharingStatus.collection.createIndex({ userID: 1 }, { unique: true });
    void this.trustedContacts.collection.createIndex({ userID: 1 }, { unique: true });
  }

  /**
   * Share or update a user's location.
   */
  async shareLocation(userID: ObjectId, latitude: number, longitude: number) {
    const timestamp = new Date();

    // Check if location sharing is enabled for the user
    const status = await this.sharingStatus.readOne({ userID });
    if (status && !status.enabled) {
      throw new NotAllowedError("Location sharing is disabled for this user.");
    }

    await this.locations.collection.updateOne(
      { userID },
      { $set: { userID, latitude, longitude, timestamp } },
      { upsert: true }
    );
    return { msg: "Location updated successfully." };
  }

  /**
   * Stop sharing a user's location.
   */
  async stopSharingLocation(userID: ObjectId) {
    await this.locations.deleteOne({ userID });
    return { msg: "Location sharing stopped." };
  }

  /**
   * Get a user's shared location.
   */
  async getLocation(userID: ObjectId) {
    const location = await this.locations.readOne({ userID });
    if (!location) {
      throw new NotAllowedError("User is not sharing their location.");
    }
    return location;
  }

  /**
   * Enable location sharing for a user.
   */
  async enableLocationSharing(userID: ObjectId) {
    await this.sharingStatus.collection.updateOne(
      { userID },
      { $set: { userID, enabled: true } },
      { upsert: true }
    );
    return { msg: "Location sharing enabled." };
  }

  /**
   * Disable location sharing for a user.
   */
  async disableLocationSharing(userID: ObjectId) {
    await this.sharingStatus.collection.updateOne(
      { userID },
      { $set: { enabled: false } },
      { upsert: true }
    );
    // Optionally, stop sharing location when disabled
    await this.stopSharingLocation(userID);
    return { msg: "Location sharing disabled." };
  }

  /**
   * Add a trusted contact for a user.
   */
  async addTrustedContact(userID: ObjectId, contactID: ObjectId) {
    const doc = await this.trustedContacts.readOne({ userID });
    if (doc) {
      if (doc.contacts.includes(contactID)) {
        return { msg: "Contact is already trusted." };
      }
      doc.contacts.push(contactID);
      await this.trustedContacts.replaceOne({ userID }, doc);
    } else {
      const newDoc: TrustedContactsDoc = {
        _id: new ObjectId(),
        userID,
        contacts: [contactID],
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
      await this.trustedContacts.createOne(newDoc);
    }
    return { msg: "Trusted contact added." };
  }

  /**
   * Remove a trusted contact for a user.
   */
  async removeTrustedContact(userID: ObjectId, contactID: ObjectId) {
    const doc = await this.trustedContacts.readOne({ userID });
    if (doc && doc.contacts.includes(contactID)) {
      doc.contacts = doc.contacts.filter((id) => !id.equals(contactID));
      await this.trustedContacts.replaceOne({ userID }, doc);
      return { msg: "Trusted contact removed." };
    }
    return { msg: "Trusted contact not found." };
  }

  /**
   * Get all trusted contacts for a user.
   */
  async getTrustedContacts(userID: ObjectId): Promise<Contact[]> {
    const doc = await this.trustedContacts.readOne({ userID });
    return doc ? doc.contacts : [];
  }

  /**
   * Get the sharing status of a user.
   */
  async getSharingStatus(userID: ObjectId): Promise<boolean> {
    const status = await this.sharingStatus.readOne({ userID });
    return status ? status.enabled : false;
  }

  /**
   * Get all current locations of a user's trusted contacts.
   */
  async getTrustedContactsLocations(userID: ObjectId): Promise<LocationDoc[]> {
    const contacts = await this.getTrustedContacts(userID);
    if (contacts.length === 0) {
      return [];
    }
    return this.locations.readMany({ userID: { $in: contacts } });
  }
}
