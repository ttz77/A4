import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Friending, Joining, Posting, Sessioning, VerifyingIdentity } from "./app";
import { NotFoundError } from "./concepts/errors";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import { VerificationData } from "./concepts/verifying";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    // Ensure the user is verified before creating a post
    await VerifyingIdentity.assertUserVerified(user);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }
  // Verification Routes
  @Router.post("/verifications")
  async submitVerification(session: SessionDoc, data: string) {
    const userID = Sessioning.getUser(session);
    const verificationData: VerificationData = { method: "government_id", data };
    await VerifyingIdentity.submitVerification(userID, verificationData);
    return { msg: "Verification submitted successfully." };
  }  

  @Router.get("/verifications/status")
  async getVerificationStatus(session: SessionDoc) {
    const userID = Sessioning.getUser(session);
    const statusResult = await VerifyingIdentity.getVerificationStatus(userID);
    return statusResult;
  }

  // for testing only
  @Router.put("/verifications/:userID/approve")
  async approveVerification(session: SessionDoc, userID: string) {
    // For testing purposes, we won't check for admin privileges here.
    const userObjectID = new ObjectId(userID);
    await VerifyingIdentity.approveVerification(userObjectID);
    return { msg: "Verification approved successfully." };
  }


  // Participation Routes
  @Router.post("/events/:id/join")
  async joinEvent(session: SessionDoc, id: string) {
    const userID = Sessioning.getUser(session);
    const eventID = new ObjectId(id);
    // Ensure the event exists
    const event = await Posting.posts.readOne({ _id: eventID });
    if (!event) {
      throw new NotFoundError("Event not found.");
    }
    await Joining.joinActivity(userID, eventID);
    return { msg: "Successfully joined the event." };
  }

  @Router.delete("/events/:id/join")
  async leaveEvent(session: SessionDoc, id: string) {
    const userID = Sessioning.getUser(session);
    const eventID = new ObjectId(id);
    const result = await Joining.leaveActivity(userID, eventID);
    return result;
  }

  // Retrieves participants of an event
  @Router.get("/events/:id/participants")
  async getEventParticipants(id: string) {
    const eventID = new ObjectId(id);
    const participantIDs = await Joining.getParticipants(eventID);
    const participants = await Authing.idsToUsernames(participantIDs);
    return participants;
  }

  // Retrieves events that a user has joined.
  @Router.get("/users/:username/events")
  async getUserEvents(username: string) {
    const user = await Authing.getUserByUsername(username);
    const eventIDs = await Joining.getActivitiesForUser(user._id);
    const events = await Posting.posts.readMany({ _id: { $in: eventIDs } });
    return Responses.posts(events);
  }

  // Endorsement Routes
  @Router.post("/users/:username/endorsements")
  async endorseUser(session: SessionDoc, username: string, skill: string) {
  }

  @Router.delete("/users/:username/endorsements")
  async removeEndorsement(session: SessionDoc, username: string, skill: string) {
  }

  @Router.get("/users/:username/endorsements")
  async getUserEndorsements(username: string) {
  }

  // Location Sharing Routes

  @Router.post("/location/share")
  async shareLocation(session: SessionDoc, latitude: number, longitude: number) {
  }

  @Router.delete("/location/share")
  async stopSharingLocation(session: SessionDoc) {
  }

  @Router.get("/users/:username/location")
  async getUserLocation(session: SessionDoc, username: string) {
  }


}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
